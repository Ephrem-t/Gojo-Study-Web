import React from 'react';
import {
  FaArrowDown,
  FaArrowUp,
  FaCalendarAlt,
  FaChartBar,
  FaChartLine,
  FaClipboardList,
  FaClock,
  FaExclamationCircle,
  FaFileAlt,
  FaFolderOpen,
  FaHandshake,
  FaMapMarkedAlt,
  FaRegCalendarCheck,
  FaUserPlus,
  FaUsers,
} from 'react-icons/fa';

const THEME = {
  panel: 'var(--surface-panel)',
  panelAlt: 'var(--surface-muted)',
  accentPanel: 'var(--surface-accent)',
  border: 'var(--border-soft)',
  borderStrong: 'var(--border-strong)',
  text: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
  shadow: 'var(--shadow-panel)',
  shadowSoft: 'var(--shadow-soft)',
};

function SectionCard({ title, subtitle, rightSlot, children, style = {} }) {
  return (
    <section
      style={{
        background: THEME.panel,
        border: `1px solid ${THEME.border}`,
        borderRadius: 24,
        padding: 22,
        boxShadow: THEME.shadow,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: THEME.text, letterSpacing: '-0.02em' }}>{title}</div>
          {subtitle ? <div style={{ marginTop: 6, fontSize: 13, color: THEME.muted, lineHeight: 1.6, maxWidth: 640 }}>{subtitle}</div> : null}
        </div>
        {rightSlot ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{rightSlot}</div> : null}
      </div>
      <div style={{ marginTop: 18 }}>{children}</div>
    </section>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 34,
        padding: '0 14px',
        borderRadius: 999,
        border: active ? `1px solid ${THEME.borderStrong}` : `1px solid ${THEME.border}`,
        background: active ? THEME.accentPanel : THEME.panel,
        color: active ? THEME.text : THEME.secondary,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function IconToggleButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        border: active ? `1px solid ${THEME.borderStrong}` : `1px solid ${THEME.border}`,
        background: active ? THEME.accentPanel : THEME.panel,
        color: active ? THEME.text : THEME.muted,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: active ? THEME.shadowSoft : 'none',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
    </button>
  );
}

function SummaryTile({ label, value, note, icon, accent, tint }) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${THEME.border}`,
        background: THEME.panel,
        padding: 18,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 14,
        boxShadow: THEME.shadow,
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800, color: THEME.text, lineHeight: 1 }}>{value}</div>
        {note ? <div style={{ marginTop: 8, fontSize: 13, color: THEME.muted, lineHeight: 1.55 }}>{note}</div> : null}
      </div>
      <div style={{ width: 46, height: 46, borderRadius: 16, background: tint, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${THEME.border}`, fontSize: 18, flexShrink: 0 }}>
        {icon}
      </div>
    </div>
  );
}

function StatusSplit({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {items.map((item) => (
        <div key={item.label} style={{ borderRadius: 18, border: `1px solid ${item.border}`, background: item.background, padding: '14px 15px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</div>
          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: THEME.text, lineHeight: 1 }}>{item.value}</div>
          {item.note ? <div style={{ marginTop: 6, fontSize: 12, color: THEME.muted }}>{item.note}</div> : null}
        </div>
      ))}
    </div>
  );
}

function MetricStrip({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
      {items.map((item) => (
        <div key={item.label} style={{ borderRadius: 18, border: `1px solid ${THEME.border}`, background: THEME.panelAlt, padding: '14px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span style={{ color: item.accent }}>{item.icon}</span>
            {item.label}
          </div>
          <div style={{ marginTop: 10, fontSize: 24, fontWeight: 800, color: THEME.text, lineHeight: 1 }}>{item.value}</div>
          {item.note ? <div style={{ marginTop: 6, fontSize: 12, color: THEME.muted, lineHeight: 1.5 }}>{item.note}</div> : null}
        </div>
      ))}
    </div>
  );
}

function SimpleTable({ columns, rows, emptyText }) {
  if (!rows.length) {
    return <div style={{ padding: '16px 4px 2px', fontSize: 13, color: THEME.muted }}>{emptyText}</div>;
  }

  return (
    <div style={{ borderRadius: 20, border: `1px solid ${THEME.border}`, overflow: 'hidden', background: THEME.panel }}>
      <div style={{ display: 'grid', gridTemplateColumns: columns.map((column) => column.width || '1fr').join(' '), padding: '12px 16px', background: THEME.panelAlt, borderBottom: `1px solid ${THEME.border}`, fontSize: 11, fontWeight: 800, color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {columns.map((column) => (
          <div key={column.key} style={{ textAlign: column.align || 'left' }}>{column.label}</div>
        ))}
      </div>
      {rows.map((row, index) => (
        <div key={row.key || index} style={{ display: 'grid', gridTemplateColumns: columns.map((column) => column.width || '1fr').join(' '), padding: '12px 16px', borderTop: index === 0 ? 'none' : `1px solid ${THEME.border}`, fontSize: 13, color: THEME.secondary }}>
          {columns.map((column) => (
            <div key={column.key} style={{ textAlign: column.align || 'left', fontWeight: column.emphasis ? 700 : 500, color: column.emphasis ? THEME.text : THEME.secondary }}>
              {row[column.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function QueueList({ items, emptyText, accent }) {
  if (!items.length) {
    return <div style={{ fontSize: 13, color: THEME.muted }}>{emptyText}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, index) => (
        <div key={item.key || index} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, borderRadius: 18, border: `1px solid ${THEME.border}`, background: THEME.panel, padding: '13px 14px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.text, lineHeight: 1.35 }}>{item.title}</div>
            {item.detail ? <div style={{ marginTop: 4, fontSize: 12, color: THEME.muted, lineHeight: 1.5 }}>{item.detail}</div> : null}
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.meta}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DepartmentBars({ items, total }) {
  if (!items.length) {
    return <div style={{ fontSize: 13, color: THEME.muted }}>No department structure is available yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(([department, departmentCount], index) => {
        const colors = ['#0f172a', '#2563eb', '#0f766e', '#d97706', '#7c3aed', '#db2777'];
        const color = colors[index % colors.length];
        const widthPct = total > 0 ? Math.max(8, Math.round((departmentCount / total) * 100)) : 0;

        return (
          <div key={department}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6, fontSize: 13, fontWeight: 700, color: THEME.secondary }}>
              <span>{department}</span>
              <span>{departmentCount}</span>
            </div>
            <div style={{ width: '100%', height: 10, borderRadius: 999, background: THEME.panelAlt, overflow: 'hidden' }}>
              <div style={{ width: `${widthPct}%`, height: '100%', borderRadius: 999, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmploymentBars({ employmentOrder, employmentCounts, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {employmentOrder.map((employmentType) => {
        const count = employmentCounts[employmentType] || 0;
        const widthPct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={employmentType}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6, fontSize: 12, color: THEME.secondary, fontWeight: 700 }}>
              <span>{employmentType}</span>
              <span>{count} ({widthPct}%)</span>
            </div>
            <div style={{ width: '100%', height: 8, borderRadius: 999, background: THEME.panelAlt, overflow: 'hidden' }}>
              <div style={{ width: `${widthPct}%`, height: '100%', borderRadius: 999, background: THEME.text }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentPeopleList({ items, emptyText }) {
  if (!items.length) {
    return <div style={{ fontSize: 13, color: THEME.muted }}>{emptyText}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, index) => (
        <div key={`${item.name}-${item.date}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderRadius: 18, border: `1px solid ${THEME.border}`, background: THEME.panel, padding: '13px 14px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.text }}>{item.name}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: THEME.muted }}>{item.role}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: THEME.text }}>{item.date}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardOverview({
  count,
  activeEmployeesCount,
  onLeaveEmployeesCount,
  terminatedEmployeesCount,
  attendanceRecordView,
  onChangeAttendanceRecordView,
  attendanceChartMode,
  onChangeAttendanceChartMode,
  attendanceRate,
  attendanceChartNode,
  latestAttendanceSnapshot,
  onAttendanceStatusCardClick,
  showAttendancePeopleList,
  attendancePeopleLoading,
  attendanceStatusFilter,
  attendancePeopleDateLabel,
  attendancePeopleList,
  recentAttendanceRecords,
  growthTrendView,
  onChangeGrowthTrendView,
  currentGrowthTotal,
  peakGrowthPoint,
  growthTrendChartNode,
  positionChartNode,
  normalizedEmployeesLength,
  employmentOrder,
  employmentCounts,
  topDepartments,
  departmentCount,
  positionCount,
  avgTenureFormatted,
  turnoverRate,
  leavesToday,
  todayHires,
  todayPostCount,
  recentHires,
  upcomingCalendarEvents,
  recentTerminations,
}) {
  const workforceTotal = Math.max(1, normalizedEmployeesLength || 0);
  const activeRate = count ? `${Math.round((activeEmployeesCount / count) * 100)}%` : '0%';
  const leaveRate = count ? `${Math.round((onLeaveEmployeesCount / count) * 100)}%` : '0%';
  const terminationRate = count ? `${Math.round((terminatedEmployeesCount / count) * 100)}%` : '0%';
  const presentRate = latestAttendanceSnapshot?.total
    ? `${Math.round(((latestAttendanceSnapshot.presentCount || 0) / latestAttendanceSnapshot.total) * 100)}%`
    : attendanceRate;

  const attendanceStatusCards = [
    {
      label: 'Present',
      value: latestAttendanceSnapshot?.presentCount ?? 0,
      border: '#bbf7d0',
      background: '#f0fdf4',
    },
    {
      label: 'Late',
      value: latestAttendanceSnapshot?.lateCount ?? 0,
      border: '#fde68a',
      background: '#fffbeb',
    },
    {
      label: 'Absent',
      value: latestAttendanceSnapshot?.absentCount ?? 0,
      border: '#fecaca',
      background: '#fef2f2',
    },
  ];

  const recentAttendanceRows = recentAttendanceRecords.map((record) => ({
    key: record.date,
    label: record.date,
    rate: `${record.rate}%`,
    present: record.presentCount,
    late: record.lateCount,
    absent: record.absentCount,
  }));

  const deadlineItems = (upcomingCalendarEvents || []).slice(0, 4).map((eventItem, index) => ({
    key: `${eventItem.id || eventItem.eventId || eventItem.gregorianDate || index}`,
    title: eventItem.title || 'Upcoming deadline',
    detail: eventItem.notes || eventItem.category || eventItem.type || 'School deadline',
    meta: eventItem.gregorianDate || 'Pending',
  }));

  const terminationItems = (recentTerminations || []).slice(0, 4).map((item, index) => ({
    key: `${item.name}-${item.date}-${index}`,
    title: item.name,
    detail: `${item.position || 'Employee'}${item.department ? ` • ${item.department}` : ''}${item.reason ? ` • ${item.reason}` : ''}`,
    meta: item.date || 'Recorded',
  }));

  return (
    <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, background: 'transparent' }}>
      <section
        style={{
          borderRadius: 26,
          border: `1px solid ${THEME.border}`,
          background: `linear-gradient(135deg, ${THEME.panel} 0%, ${THEME.panelAlt} 58%, ${THEME.accentPanel} 100%)`,
          padding: '22px 24px 22px',
          boxShadow: THEME.shadow,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, maxWidth: 760 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 999, background: THEME.accentPanel, border: `1px solid ${THEME.borderStrong}`, color: 'var(--accent-strong)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              HR Control Overview
            </div>
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800, color: THEME.text, lineHeight: 1.05, letterSpacing: '-0.04em' }}>
              Workforce health and immediate HR actions
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: 10, minWidth: 'min(100%, 470px)' }}>
            <SummaryTile label="Total workforce" value={count} note={`${departmentCount || 0} departments`} icon={<FaUsers />} accent="#2563eb" tint="#eff6ff" />
            <SummaryTile label="Attendance pulse" value={presentRate} note={`${latestAttendanceSnapshot?.total || 0} records`} icon={<FaRegCalendarCheck />} accent="#059669" tint="#f0fdf4" />
            <SummaryTile label="Open HR load" value={(upcomingCalendarEvents || []).length + (recentTerminations || []).length} note="Needs review" icon={<FaExclamationCircle />} accent="#d97706" tint="#fffbeb" />
          </div>
        </div>
      </section>

      <MetricStrip
        items={[
          { label: 'Active staff', value: `${activeEmployeesCount} (${activeRate})`, icon: <FaArrowUp />, accent: '#059669' },
          { label: 'On leave', value: `${onLeaveEmployeesCount} (${leaveRate})`, icon: <FaClock />, accent: '#d97706' },
          { label: 'Terminated', value: `${terminatedEmployeesCount} (${terminationRate})`, icon: <FaArrowDown />, accent: '#dc2626' },
          { label: 'Average tenure', value: avgTenureFormatted, icon: <FaHandshake />, accent: '#2563eb' },
          { label: 'Turnover', value: turnoverRate, icon: <FaChartLine />, accent: '#7c3aed' },
          { label: 'Posts today', value: todayPostCount, icon: <FaFileAlt />, accent: '#7c3aed' },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.92fr)', gap: 18, alignItems: 'start' }}>
        <SectionCard
          title="Attendance Pulse"
          subtitle="Current rate, status counts, and recent history."
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {['daily', 'weekly', 'monthly'].map((tab) => (
                <FilterChip key={tab} active={attendanceRecordView === tab} onClick={() => onChangeAttendanceRecordView(tab)}>
                  {tab}
                </FilterChip>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <IconToggleButton active={attendanceChartMode === 'bar'} onClick={() => onChangeAttendanceChartMode('bar')} icon={<FaChartBar />} label="Bar chart view" />
              <IconToggleButton active={attendanceChartMode === 'line'} onClick={() => onChangeAttendanceChartMode('line')} icon={<FaChartLine />} label="Line chart view" />
            </div>
          </div>

          <div style={{ borderRadius: 20, border: `1px solid ${THEME.border}`, background: THEME.panel, padding: 12, minHeight: 360 }}>
            {attendanceChartNode}
          </div>

          <div style={{ marginTop: 16 }}>
            <StatusSplit items={attendanceStatusCards} />
          </div>

          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <button type="button" onClick={() => onAttendanceStatusCardClick('present')} style={{ border: showAttendancePeopleList && attendanceStatusFilter === 'present' ? '1px solid #16a34a' : `1px solid ${THEME.border}`, background: showAttendancePeopleList && attendanceStatusFilter === 'present' ? '#f0fdf4' : THEME.panel, borderRadius: 16, padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: THEME.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>View present</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: THEME.text }}>{latestAttendanceSnapshot?.presentCount ?? 0}</div>
            </button>
            <button type="button" onClick={() => onAttendanceStatusCardClick('late')} style={{ border: showAttendancePeopleList && attendanceStatusFilter === 'late' ? '1px solid #d97706' : `1px solid ${THEME.border}`, background: showAttendancePeopleList && attendanceStatusFilter === 'late' ? '#fffbeb' : THEME.panel, borderRadius: 16, padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: THEME.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>View late</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: THEME.text }}>{latestAttendanceSnapshot?.lateCount ?? 0}</div>
            </button>
            <button type="button" onClick={() => onAttendanceStatusCardClick('absent')} style={{ border: showAttendancePeopleList && attendanceStatusFilter === 'absent' ? '1px solid #dc2626' : `1px solid ${THEME.border}`, background: showAttendancePeopleList && attendanceStatusFilter === 'absent' ? '#fef2f2' : THEME.panel, borderRadius: 16, padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: THEME.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>View absent</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: THEME.text }}>{latestAttendanceSnapshot?.absentCount ?? 0}</div>
            </button>
            <div style={{ border: `1px solid ${THEME.border}`, background: THEME.panelAlt, borderRadius: 16, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: THEME.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Away today</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: THEME.text }}>{leavesToday}</div>
            </div>
          </div>

          {showAttendancePeopleList ? (
            <div style={{ marginTop: 16, borderRadius: 20, border: `1px solid ${THEME.border}`, background: THEME.panel, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${THEME.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: THEME.text, textTransform: 'capitalize' }}>{attendanceStatusFilter} employees</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: THEME.muted }}>{attendancePeopleDateLabel}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: THEME.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {attendancePeopleLoading ? 'Loading' : `${attendancePeopleList.length} visible`}
                </div>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {attendancePeopleLoading ? (
                  <div style={{ padding: '16px', fontSize: 13, color: THEME.muted }}>Loading employees for this filter...</div>
                ) : attendancePeopleList.length === 0 ? (
                  <div style={{ padding: '16px', fontSize: 13, color: THEME.muted }}>No employees found for this filter.</div>
                ) : (
                  attendancePeopleList.map((entry, index) => (
                    <div key={`${entry.employeeId}-${entry.status}-${entry.sourceDate}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderTop: index === 0 ? 'none' : `1px solid ${THEME.border}` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.text }}>{entry.name}</div>
                        {attendanceRecordView === 'daily' ? null : <div style={{ marginTop: 4, fontSize: 12, color: THEME.muted }}>{entry.bucketLabel} • {entry.sourceDate}</div>}
                      </div>
                      <div style={{ fontSize: 12, color: THEME.muted, fontWeight: 700 }}>{entry.employeeId}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
            <SimpleTable
              columns={[
                { key: 'label', label: attendanceRecordView === 'daily' ? 'Date' : attendanceRecordView === 'weekly' ? 'Week' : 'Month', width: '1.2fr', emphasis: true },
                { key: 'rate', label: 'Rate', width: '1fr', align: 'right', emphasis: true },
                { key: 'present', label: 'Present', width: '1fr', align: 'right' },
                { key: 'late', label: 'Late', width: '1fr', align: 'right' },
                { key: 'absent', label: 'Absent', width: '1fr', align: 'right' },
              ]}
              rows={recentAttendanceRows}
              emptyText="No attendance records found."
            />
          </div>
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SectionCard
            title="HR Action Queue"
            subtitle="Deadlines and recent exits."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 800, color: THEME.text }}>
                  <FaCalendarAlt color="#2563eb" /> Upcoming deadlines
                </div>
                <QueueList items={deadlineItems} emptyText="No upcoming HR-relevant deadlines are available right now." accent="#2563eb" />
              </div>

                <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 800, color: THEME.text }}>
                  <FaClipboardList color="#dc2626" /> Recent terminations
                </div>
                <QueueList items={terminationItems} emptyText="No recent terminations were found in the current employee records." accent="#dc2626" />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Immediate Staffing Signals"
            subtitle="Today at a glance."
          >
            <MetricStrip
              items={[
                { label: 'New hires today', value: todayHires, icon: <FaUserPlus />, accent: '#059669' },
                { label: 'Recent hires', value: recentHires.length, icon: <FaArrowUp />, accent: '#2563eb' },
                { label: 'Positions live', value: positionCount || 0, icon: <FaFolderOpen />, accent: '#0f766e' },
              ]}
            />
          </SectionCard>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: 18, alignItems: 'start' }}>
        <SectionCard
          title="Organization Structure"
          subtitle="Departments, positions, and employment types."
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: 18, alignItems: 'start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 800, color: THEME.text }}>
                <FaMapMarkedAlt color="#2563eb" /> Department spread
              </div>
              <DepartmentBars items={topDepartments} total={normalizedEmployeesLength} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 800, color: THEME.text }}>
                <FaHandshake color="#0f766e" /> Employment mix
              </div>
              <EmploymentBars employmentOrder={employmentOrder} employmentCounts={employmentCounts} total={workforceTotal} />
            </div>
          </div>

          <div style={{ marginTop: 18, borderTop: `1px solid ${THEME.border}`, paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 800, color: THEME.text }}>
              <FaFolderOpen color="#0f766e" /> Position coverage
            </div>
            {positionChartNode}
          </div>
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SectionCard
            title="Hiring Trend"
            subtitle="A cleaner view of hiring momentum from real hire dates without competing with too many other widgets."
            rightSlot={['monthly', 'annual'].map((mode) => (
              <FilterChip key={mode} active={growthTrendView === mode} onClick={() => onChangeGrowthTrendView(mode)}>
                {mode === 'annual' ? 'Yearly' : 'Monthly'}
              </FilterChip>
            ))}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div style={{ borderRadius: 18, border: `1px solid ${THEME.border}`, background: THEME.panelAlt, padding: '14px 15px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{growthTrendView === 'monthly' ? 'Last 12 months' : 'Last 6 years'}</div>
                <div style={{ marginTop: 8, fontSize: 26, fontWeight: 800, color: THEME.text }}>{currentGrowthTotal}</div>
              </div>
              <div style={{ borderRadius: 18, border: `1px solid ${THEME.border}`, background: THEME.panelAlt, padding: '14px 15px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: THEME.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Peak period</div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 800, color: THEME.text, lineHeight: 1.35 }}>{peakGrowthPoint?.label || '—'}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: THEME.muted }}>{Number(peakGrowthPoint?.totalCount || 0)} hires</div>
              </div>
            </div>
            <div style={{ marginTop: 16, borderRadius: 20, border: `1px solid ${THEME.border}`, background: THEME.panel, padding: 10 }}>
              {growthTrendChartNode}
            </div>
          </SectionCard>

          <SectionCard
            title="Recent Joiners"
            subtitle="The latest employees to join, kept compact and readable for onboarding follow-up."
          >
            <RecentPeopleList items={recentHires} emptyText="No recent hires were found in the current records." />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
