const DEFAULTS = {
  mode: 'savings',
  hrUsers: 100,
  employeeCount: 1000,
  workDays: 22,
  employeeSummaryPayloadMb: 0.95,
  employeeViewsPerDay: 8,
  employeeSummaryCacheHitRate: 0.75,
  messagesPerHrPerMonth: 50,
  activeChatThreadsPerHr: 0,
  chatPageHoursPerDay: 0.5,
  chatRefreshIntervalMinutes: 1,
  chatSummaryEntryKb: 0.45,
  dashboardChatChecksPerDay: 3,
  visiblePresenceContactsPerRefresh: 14,
  presenceEntryKb: 0.18,
  chatMessagePayloadKb: 1.4,
  chatMessageReadFanout: 2.4,
  chatImageMessagesPerHrPerMonth: 0,
  optimizedChatImageMb: 0.18,
  chatImageReadFanout: 2.2,
  chatRetentionMonths: 1,
  attendanceSummaryPayloadKb: 14,
  attendanceViewsPerDay: 1,
  attendanceDetailPayloadKb: 32,
  attendanceDetailViewsPerDay: 0.35,
  postsPayloadKb: 28,
  postFeedViewsPerDay: 4,
  calendarPayloadKb: 12,
  calendarViewsPerDay: 2,
  profileUploadsPerMonth: 80,
  originalProfileImageMb: 1.2,
  optimizedProfileImageMb: 0.35,
  postImageUploadsPerMonth: 250,
  originalPostImageMb: 0.88,
  optimizedPostImageMb: 0.45,
  previewPostImageMb: 0.14,
  postFeedViewsPerImage: 60,
  previewFeedHitRate: 0.85,
  retainedPostMonths: 1,
  lazyLoadedImageGbSaved: 30,
  rtdbDownloadOverheadMultiplier: 1.18,
  rtdbDownloadUsdPerGb: 1,
  rtdbStorageUsdPerGbMonth: 5,
  storageStandardUsdPerGbMonth: 0.02,
  storageEgressUsdPerGb: 0.12,
  rtdbFreeDownloadGb: 10,
  rtdbFreeStorageGb: 1,
  storageFreeGbMonth: 5,
  storageFreeEgressGb: 100,
};

function parseArgs(argv) {
  return argv.reduce((accumulator, argument) => {
    if (!argument.startsWith('--')) {
      return accumulator;
    }

    const [rawKey, rawValue = 'true'] = argument.slice(2).split('=');
    const key = String(rawKey || '').trim();
    if (!key) {
      return accumulator;
    }

    const numericValue = Number(rawValue);
    accumulator[key] = Number.isFinite(numericValue) ? numericValue : rawValue;
    return accumulator;
  }, {});
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function clampNonNegative(value) {
  return Math.max(0, Number(value || 0));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function formatUsd(value) {
  return `$${round(value, 2).toFixed(2)}`;
}

function formatGb(value) {
  return `${round(value, 2).toFixed(2)} GB`;
}

function formatMb(value) {
  return `${round(value, 2).toFixed(2)} MB`;
}

function formatUsageGb(valueGb) {
  const normalized = clampNonNegative(valueGb);
  if (normalized > 0 && normalized < 0.1) {
    return formatMb(normalized * 1024);
  }
  return formatGb(normalized);
}

function formatCount(value) {
  return round(value, 0).toLocaleString('en-US');
}

function formatPercent(value) {
  return `${round(value * 100, 1).toFixed(1)}%`;
}

function toGbFromMb(value) {
  return clampNonNegative(value) / 1024;
}

function toGbFromKb(value) {
  return clampNonNegative(value) / (1024 * 1024);
}

function getBillableUsage(usageGb, freeTierGb) {
  return Math.max(0, clampNonNegative(usageGb) - clampNonNegative(freeTierGb));
}

function normalizeOptions(rawOptions) {
  const options = { ...DEFAULTS, ...rawOptions };

  options.mode = String(options.mode || 'savings').trim().toLowerCase() || 'savings';
  if (!['savings', 'total', 'all'].includes(options.mode)) {
    throw new Error(`Unsupported mode "${options.mode}". Use --mode=savings, --mode=total, or --mode=all.`);
  }

  for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
    if (typeof defaultValue === 'number') {
      options[key] = clampNonNegative(options[key]);
    }
  }

  options.employeeSummaryCacheHitRate = Math.min(1, options.employeeSummaryCacheHitRate);
  options.previewFeedHitRate = Math.min(1, options.previewFeedHitRate);
  options.rtdbDownloadOverheadMultiplier = Math.max(1, options.rtdbDownloadOverheadMultiplier);
  options.chatRefreshIntervalMinutes = Math.max(1, options.chatRefreshIntervalMinutes);

  if (options.activeChatThreadsPerHr <= 0) {
    options.activeChatThreadsPerHr = Math.max(
      4,
      Math.min(20, Math.ceil(options.messagesPerHrPerMonth / 5))
    );
  }

  return options;
}

function computeSavingsModel(options) {
  const employeeSummaryDownloadGbSaved = (
    options.hrUsers
    * options.workDays
    * options.employeeViewsPerDay
    * options.employeeSummaryPayloadMb
    * options.employeeSummaryCacheHitRate
  ) / 1024;

  const profileStorageGbSaved = (
    options.profileUploadsPerMonth
    * Math.max(0, options.originalProfileImageMb - options.optimizedProfileImageMb)
  ) / 1024;

  const postStorageGbSaved = (
    options.postImageUploadsPerMonth
    * Math.max(0, options.originalPostImageMb - options.optimizedPostImageMb)
  ) / 1024;

  const previewFeedEgressGbSaved = (
    options.postImageUploadsPerMonth
    * options.postFeedViewsPerImage
    * options.previewFeedHitRate
    * Math.max(0, options.optimizedPostImageMb - options.previewPostImageMb)
  ) / 1024;

  const rtdbSavingsUsd = employeeSummaryDownloadGbSaved * options.rtdbDownloadUsdPerGb;
  const previewFeedEgressSavingsUsd = previewFeedEgressGbSaved * options.storageEgressUsdPerGb;
  const lazyImageLoadingSavingsUsd = options.lazyLoadedImageGbSaved * options.storageEgressUsdPerGb;
  const storageEgressSavingsUsd = (
    previewFeedEgressGbSaved + options.lazyLoadedImageGbSaved
  ) * options.storageEgressUsdPerGb;
  const storageAtRestGbSaved = profileStorageGbSaved + postStorageGbSaved;
  const storageAtRestSavingsUsd = storageAtRestGbSaved * options.storageStandardUsdPerGbMonth;
  const totalSavingsUsd = rtdbSavingsUsd + storageEgressSavingsUsd + storageAtRestSavingsUsd;

  return {
    employeeSummaryDownloadGbSaved,
    previewFeedEgressGbSaved,
    lazyImageLoadingSavingsUsd,
    options,
    rows: [
      ['RTDB employee summary cache', employeeSummaryDownloadGbSaved, rtdbSavingsUsd],
      ['Storage feed preview variants', previewFeedEgressGbSaved, previewFeedEgressSavingsUsd],
      ['Storage lazy image loading', options.lazyLoadedImageGbSaved, lazyImageLoadingSavingsUsd],
      ['Storage at-rest reduction', storageAtRestGbSaved, storageAtRestSavingsUsd],
    ],
    totalSavingsUsd,
  };
}

function computeTotalModel(options) {
  const totalMessages = options.hrUsers * options.messagesPerHrPerMonth;
  const totalChatImageMessages = Math.min(totalMessages, options.hrUsers * options.chatImageMessagesPerHrPerMonth);
  const totalTextMessages = Math.max(0, totalMessages - totalChatImageMessages);
  const chatRefreshesPerDay = (options.chatPageHoursPerDay * 60) / options.chatRefreshIntervalMinutes;
  const totalProfileImages = options.employeeCount + options.hrUsers;
  const activeConversationPairs = options.hrUsers * Math.min(options.employeeCount, options.activeChatThreadsPerHr);

  const usefulRtdbDownloadComponents = [
    {
      label: 'Employee summaries',
      usageGb: toGbFromMb(
        options.hrUsers
        * options.workDays
        * options.employeeViewsPerDay
        * options.employeeSummaryPayloadMb
        * (1 - options.employeeSummaryCacheHitRate)
      ),
    },
    {
      label: 'Chat summary refresh',
      usageGb: toGbFromKb(
        options.hrUsers
        * options.workDays
        * chatRefreshesPerDay
        * options.activeChatThreadsPerHr
        * options.chatSummaryEntryKb
      ),
    },
    {
      label: 'Visible presence refresh',
      usageGb: toGbFromKb(
        options.hrUsers
        * options.workDays
        * chatRefreshesPerDay
        * options.visiblePresenceContactsPerRefresh
        * options.presenceEntryKb
      ),
    },
    {
      label: 'Dashboard chat activity',
      usageGb: toGbFromKb(
        options.hrUsers
        * options.workDays
        * options.dashboardChatChecksPerDay
        * options.activeChatThreadsPerHr
        * options.chatSummaryEntryKb
      ),
    },
    {
      label: 'Chat messages',
      usageGb: toGbFromKb(
        totalTextMessages
        * options.chatMessageReadFanout
        * options.chatMessagePayloadKb
      ),
    },
    {
      label: 'Attendance summary',
      usageGb: toGbFromKb(
        options.hrUsers
        * options.workDays
        * options.attendanceViewsPerDay
        * options.attendanceSummaryPayloadKb
      ),
    },
    {
      label: 'Attendance detail',
      usageGb: toGbFromKb(
        options.hrUsers
        * options.workDays
        * options.attendanceDetailViewsPerDay
        * options.attendanceDetailPayloadKb
      ),
    },
    {
      label: 'Posts metadata',
      usageGb: toGbFromKb(
        options.hrUsers
        * options.workDays
        * options.postFeedViewsPerDay
        * options.postsPayloadKb
      ),
    },
    {
      label: 'Calendar events',
      usageGb: toGbFromKb(
        options.hrUsers
        * options.workDays
        * options.calendarViewsPerDay
        * options.calendarPayloadKb
      ),
    },
  ].filter((item) => item.usageGb > 0);

  const usefulRtdbDownloadGb = sum(usefulRtdbDownloadComponents.map((item) => item.usageGb));
  const rtdbOverheadGb = usefulRtdbDownloadGb * (options.rtdbDownloadOverheadMultiplier - 1);
  const billedRtdbDownloadComponents = [
    ...usefulRtdbDownloadComponents,
    {
      label: 'Firebase protocol and TLS overhead',
      usageGb: rtdbOverheadGb,
    },
  ].filter((item) => item.usageGb > 0);
  const billedRtdbDownloadGb = sum(billedRtdbDownloadComponents.map((item) => item.usageGb));

  const rtdbStorageComponents = [
    {
      label: 'EmployeeSummaries',
      usageGb: toGbFromMb(options.employeeSummaryPayloadMb),
    },
    {
      label: 'Chats messages',
      usageGb: toGbFromKb(
        totalTextMessages
        * options.chatRetentionMonths
        * options.chatMessagePayloadKb
      ),
    },
    {
      label: 'Chat_Summaries',
      usageGb: toGbFromKb(
        activeConversationPairs
        * 2
        * options.chatSummaryEntryKb
      ),
    },
    {
      label: 'Presence',
      usageGb: toGbFromKb(totalProfileImages * options.presenceEntryKb),
    },
    {
      label: 'Attendance summaries',
      usageGb: toGbFromKb((options.attendanceSummaryPayloadKb / 90) * options.workDays),
    },
  ].filter((item) => item.usageGb > 0);
  const rtdbStorageGb = sum(rtdbStorageComponents.map((item) => item.usageGb));

  const storageAtRestComponents = [
    {
      label: 'Profile images',
      usageGb: toGbFromMb(totalProfileImages * options.optimizedProfileImageMb),
    },
    {
      label: 'Post media and previews',
      usageGb: toGbFromMb(
        options.postImageUploadsPerMonth
        * options.retainedPostMonths
        * (options.optimizedPostImageMb + options.previewPostImageMb)
      ),
    },
    {
      label: 'Chat images',
      usageGb: toGbFromMb(
        totalChatImageMessages
        * options.chatRetentionMonths
        * options.optimizedChatImageMb
      ),
    },
  ].filter((item) => item.usageGb > 0);
  const storageAtRestGb = sum(storageAtRestComponents.map((item) => item.usageGb));

  const storageEgressComponents = [
    {
      label: 'Post feed media',
      usageGb: toGbFromMb(
        options.postImageUploadsPerMonth
        * options.postFeedViewsPerImage
        * (
          (options.previewFeedHitRate * options.previewPostImageMb)
          + ((1 - options.previewFeedHitRate) * options.optimizedPostImageMb)
        )
      ),
    },
    {
      label: 'Chat images',
      usageGb: toGbFromMb(
        totalChatImageMessages
        * options.chatImageReadFanout
        * options.optimizedChatImageMb
      ),
    },
  ].filter((item) => item.usageGb > 0);
  const storageEgressGb = sum(storageEgressComponents.map((item) => item.usageGb));

  const rawCosts = {
    rtdbDownloadUsd: billedRtdbDownloadGb * options.rtdbDownloadUsdPerGb,
    rtdbStorageUsd: rtdbStorageGb * options.rtdbStorageUsdPerGbMonth,
    storageAtRestUsd: storageAtRestGb * options.storageStandardUsdPerGbMonth,
    storageEgressUsd: storageEgressGb * options.storageEgressUsdPerGb,
  };
  rawCosts.totalUsd = sum(Object.values(rawCosts));

  const billableUsage = {
    rtdbDownloadGb: getBillableUsage(billedRtdbDownloadGb, options.rtdbFreeDownloadGb),
    rtdbStorageGb: getBillableUsage(rtdbStorageGb, options.rtdbFreeStorageGb),
    storageAtRestGb: getBillableUsage(storageAtRestGb, options.storageFreeGbMonth),
    storageEgressGb: getBillableUsage(storageEgressGb, options.storageFreeEgressGb),
  };

  const netCosts = {
    rtdbDownloadUsd: billableUsage.rtdbDownloadGb * options.rtdbDownloadUsdPerGb,
    rtdbStorageUsd: billableUsage.rtdbStorageGb * options.rtdbStorageUsdPerGbMonth,
    storageAtRestUsd: billableUsage.storageAtRestGb * options.storageStandardUsdPerGbMonth,
    storageEgressUsd: billableUsage.storageEgressGb * options.storageEgressUsdPerGb,
  };
  netCosts.totalUsd = sum(Object.values(netCosts));

  return {
    assumptions: {
      totalMessages,
      totalTextMessages,
      totalChatImageMessages,
      activeConversationPairs,
      chatRefreshesPerDay,
      totalProfileImages,
    },
    billedRtdbDownloadComponents,
    billedRtdbDownloadGb,
    usefulRtdbDownloadGb,
    rtdbStorageComponents,
    rtdbStorageGb,
    storageAtRestComponents,
    storageAtRestGb,
    storageEgressComponents,
    storageEgressGb,
    rawCosts,
    billableUsage,
    netCosts,
  };
}

function printComponentSection(title, rows) {
  console.log(title);
  for (const row of rows) {
    console.log(`- ${row.label}: ${formatUsageGb(row.usageGb)}`);
  }
  console.log('');
}

function printSavingsReport(options) {
  const report = computeSavingsModel(options);

  console.log('Gojo HR Firebase Cost Estimator');
  console.log('');
  console.log('Savings mode');
  console.log(`- HR users: ${formatCount(options.hrUsers)}`);
  console.log(`- Work days per month: ${formatCount(options.workDays)}`);
  console.log(`- Employee summary payload: ${formatMb(options.employeeSummaryPayloadMb)}`);
  console.log(`- Employee page opens per HR per day: ${formatCount(options.employeeViewsPerDay)}`);
  console.log(`- Summary cache hit rate: ${formatPercent(options.employeeSummaryCacheHitRate)}`);
  console.log(`- Post images per month: ${formatCount(options.postImageUploadsPerMonth)}`);
  console.log(`- Feed views per image post: ${formatCount(options.postFeedViewsPerImage)}`);
  console.log(`- Feed preview hit rate: ${formatPercent(options.previewFeedHitRate)}`);
  console.log('');
  console.log('Savings');

  for (const [label, usageGb, usd] of report.rows) {
    console.log(`- ${label}: ${formatGb(usageGb)}, ${formatUsd(usd)}/month`);
  }

  console.log('');
  console.log(`Total estimated monthly savings before free-tier offsets: ${formatUsd(report.totalSavingsUsd)}`);
  console.log('');
}

function printTotalCostReport(options) {
  const report = computeTotalModel(options);

  console.log('Gojo HR Firebase Cost Estimator');
  console.log('');
  console.log('Total-cost mode');
  console.log(`- HR users: ${formatCount(options.hrUsers)}`);
  console.log(`- Employees: ${formatCount(options.employeeCount)}`);
  console.log(`- Messages per HR per month: ${formatCount(options.messagesPerHrPerMonth)}`);
  console.log(`- Total monthly messages: ${formatCount(report.assumptions.totalMessages)}`);
  console.log(`- Active chat threads per HR: ${formatCount(options.activeChatThreadsPerHr)}`);
  console.log(`- Chat page visible time per HR per work day: ${round(options.chatPageHoursPerDay, 2)} hours`);
  console.log(`- Employee summary cache hit rate: ${formatPercent(options.employeeSummaryCacheHitRate)}`);
  console.log(`- RTDB billed-download overhead multiplier: ${round(options.rtdbDownloadOverheadMultiplier, 2).toFixed(2)}x`);
  console.log('');

  printComponentSection('Realtime Database billed download', report.billedRtdbDownloadComponents);
  printComponentSection('Realtime Database storage at rest', report.rtdbStorageComponents);
  printComponentSection('Cloud Storage at rest', report.storageAtRestComponents);
  if (report.storageEgressComponents.length) {
    printComponentSection('Cloud Storage egress', report.storageEgressComponents);
  }

  console.log('Monthly totals before free tier');
  console.log(`- RTDB download: ${formatUsageGb(report.billedRtdbDownloadGb)}, ${formatUsd(report.rawCosts.rtdbDownloadUsd)}`);
  console.log(`- RTDB storage: ${formatUsageGb(report.rtdbStorageGb)}, ${formatUsd(report.rawCosts.rtdbStorageUsd)}`);
  console.log(`- Storage at rest: ${formatUsageGb(report.storageAtRestGb)}, ${formatUsd(report.rawCosts.storageAtRestUsd)}`);
  console.log(`- Storage egress: ${formatUsageGb(report.storageEgressGb)}, ${formatUsd(report.rawCosts.storageEgressUsd)}`);
  console.log(`- Total before free tier: ${formatUsd(report.rawCosts.totalUsd)}`);
  console.log('');

  console.log('Monthly totals after Firebase and Cloud free tiers');
  console.log(`- RTDB download billable: ${formatUsageGb(report.billableUsage.rtdbDownloadGb)}, ${formatUsd(report.netCosts.rtdbDownloadUsd)}`);
  console.log(`- RTDB storage billable: ${formatUsageGb(report.billableUsage.rtdbStorageGb)}, ${formatUsd(report.netCosts.rtdbStorageUsd)}`);
  console.log(`- Storage at rest billable: ${formatUsageGb(report.billableUsage.storageAtRestGb)}, ${formatUsd(report.netCosts.storageAtRestUsd)}`);
  console.log(`- Storage egress billable: ${formatUsageGb(report.billableUsage.storageEgressGb)}, ${formatUsd(report.netCosts.storageEgressUsd)}`);
  console.log(`- Total after free tier: ${formatUsd(report.netCosts.totalUsd)}`);
  console.log('');

  console.log('Notes');
  console.log(`- Employee summaries are usually the main RTDB cost driver because /employees/summary returns the full EmployeeSummaries map.`);
  console.log(`- Chat message count itself is cheap; chat cost rises mostly when the chat page stays open and keeps refreshing summaries and presence.`);
  console.log(`- Post media egress uses the current optimized HR flow with previews first and full images only for the remaining misses.`);
  console.log('');
}

function printUsage() {
  console.log('Override any assumption with --key=value. Examples:');
  console.log('node scripts/estimate-hr-firebase-cost.mjs --mode=savings --hrUsers=140 --postImageUploadsPerMonth=320');
  console.log('node scripts/estimate-hr-firebase-cost.mjs --mode=total --hrUsers=100 --employeeCount=1000 --messagesPerHrPerMonth=50');
  console.log('node scripts/estimate-hr-firebase-cost.mjs --mode=total --chatPageHoursPerDay=6 --messagesPerHrPerMonth=50');
}

try {
  const options = normalizeOptions(parseArgs(process.argv.slice(2)));

  if (options.mode === 'savings' || options.mode === 'all') {
    printSavingsReport(options);
  }

  if (options.mode === 'all') {
    console.log('---');
    console.log('');
  }

  if (options.mode === 'total' || options.mode === 'all') {
    printTotalCostReport(options);
  }

  printUsage();
} catch (error) {
  console.error(String(error?.message || error));
  process.exitCode = 1;
}