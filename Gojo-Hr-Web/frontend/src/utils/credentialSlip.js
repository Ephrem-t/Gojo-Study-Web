function normalizeCredentialSlip(credentials = {}) {
  return {
    name: String(credentials?.name || 'Employee').trim() || 'Employee',
    role: String(credentials?.role || 'Staff').trim() || 'Staff',
    employeeId: String(credentials?.employeeId || '').trim(),
    loginUsername: String(credentials?.loginUsername || '').trim(),
    password: String(credentials?.password || '').trim(),
  }
}

export function hasCredentialSlipData(credentials) {
  const normalized = normalizeCredentialSlip(credentials)
  return Boolean(normalized.employeeId && normalized.loginUsername && normalized.password)
}

function escapeCredentialValue(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildCredentialSlipHtml(credentials, mode = 'print') {
  const normalized = normalizeCredentialSlip(credentials)
  const title = mode === 'pdf' ? 'Credential Slip PDF Export' : 'Credential Slip'
  const generatedAt = new Date().toLocaleString()
  const printScript = mode === 'print'
    ? `
        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      `
    : ''

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: #f8fbff;
            color: #0f172a;
          }
          .slip-shell {
            max-width: 420px;
            margin: 0 auto;
            border: 1px solid #dbeafe;
            border-radius: 18px;
            background: #ffffff;
            overflow: hidden;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
          }
          .slip-header {
            padding: 18px 20px;
            background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%);
            border-bottom: 1px solid #e7ecf3;
          }
          .slip-badge {
            display: inline-flex;
            align-items: center;
            min-height: 28px;
            padding: 0 10px;
            border-radius: 999px;
            background: #ffffff;
            border: 1px solid #dbeafe;
            color: #1d4ed8;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .slip-title {
            margin: 12px 0 4px;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.03em;
          }
          .slip-subtitle {
            margin: 0;
            font-size: 13px;
            line-height: 1.55;
            color: #64748b;
          }
          .slip-body {
            padding: 18px 20px 20px;
          }
          .slip-grid {
            display: grid;
            gap: 12px;
          }
          .slip-row {
            border: 1px solid #e7ecf3;
            border-radius: 14px;
            padding: 12px 14px;
            background: #fbfdff;
          }
          .slip-label {
            display: block;
            font-size: 11px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          .slip-value {
            display: block;
            margin-top: 6px;
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            word-break: break-word;
          }
          .slip-note {
            margin-top: 14px;
            padding: 12px 14px;
            border-radius: 14px;
            border: 1px solid #fde68a;
            background: #fffbeb;
            color: #92400e;
            font-size: 12px;
            line-height: 1.55;
          }
          .slip-footer {
            margin-top: 14px;
            font-size: 11px;
            color: #94a3b8;
          }
          @media print {
            body {
              background: #ffffff;
              padding: 0;
            }
            .slip-shell {
              box-shadow: none;
              border-radius: 0;
              max-width: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="slip-shell">
          <div class="slip-header">
            <span class="slip-badge">Gojo HR</span>
            <h1 class="slip-title">Employee Credential Slip</h1>
            <p class="slip-subtitle">Use the portal username and temporary password to access the employee portal.</p>
          </div>
          <div class="slip-body">
            <div class="slip-grid">
              <div class="slip-row">
                <span class="slip-label">Employee Name</span>
                <span class="slip-value">${escapeCredentialValue(normalized.name)}</span>
              </div>
              <div class="slip-row">
                <span class="slip-label">Role</span>
                <span class="slip-value">${escapeCredentialValue(normalized.role)}</span>
              </div>
              <div class="slip-row">
                <span class="slip-label">Employee ID</span>
                <span class="slip-value">${escapeCredentialValue(normalized.employeeId)}</span>
              </div>
              <div class="slip-row">
                <span class="slip-label">Portal Username</span>
                <span class="slip-value">${escapeCredentialValue(normalized.loginUsername)}</span>
              </div>
              <div class="slip-row">
                <span class="slip-label">Temporary Password</span>
                <span class="slip-value">${escapeCredentialValue(normalized.password)}</span>
              </div>
            </div>
            <div class="slip-note">Keep this slip secure. The employee ID is for records, while the portal username and password are used for login.</div>
            <div class="slip-footer">Generated: ${escapeCredentialValue(generatedAt)}</div>
          </div>
        </div>
        ${printScript}
      </body>
    </html>
  `
}

export function buildCredentialSlipFilename(credentials) {
  const normalized = normalizeCredentialSlip(credentials)
  const employeeId = normalized.employeeId || 'employee'
  const safeEmployeeId = employeeId.replace(/[^A-Za-z0-9_-]+/g, '_')
  return `credential-slip-${safeEmployeeId}.pdf`
}

export async function downloadCredentialSlipPdf(credentials) {
  const normalized = normalizeCredentialSlip(credentials)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const left = 56
  const top = 54
  const cardWidth = pageWidth - (left * 2)
  let y = top

  const rowHeight = 58
  const labelColor = [100, 116, 139]
  const textColor = [15, 23, 42]
  const borderColor = [231, 236, 243]

  pdf.setFillColor(248, 251, 255)
  pdf.setDrawColor(219, 234, 254)
  pdf.roundedRect(left, y, cardWidth, 86, 16, 16, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(29, 78, 216)
  pdf.text('GOJO HR', left + 18, y + 22)

  pdf.setFontSize(22)
  pdf.setTextColor(...textColor)
  pdf.text('Employee Credential Slip', left + 18, y + 48)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(...labelColor)
  pdf.text('Use the portal username and temporary password to access the employee portal.', left + 18, y + 68)

  y += 104

  const rows = [
    { label: 'Employee Name', value: normalized.name },
    { label: 'Role', value: normalized.role },
    { label: 'Employee ID', value: normalized.employeeId },
    { label: 'Portal Username', value: normalized.loginUsername },
    { label: 'Temporary Password', value: normalized.password },
  ]

  rows.forEach((row) => {
    pdf.setFillColor(251, 253, 255)
    pdf.setDrawColor(...borderColor)
    pdf.roundedRect(left, y, cardWidth, rowHeight, 12, 12, 'FD')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...labelColor)
    pdf.text(String(row.label || '').toUpperCase(), left + 16, y + 18)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.setTextColor(...textColor)
    const valueLines = pdf.splitTextToSize(String(row.value || ''), cardWidth - 32)
    pdf.text(valueLines, left + 16, y + 40)

    y += rowHeight + 12
  })

  pdf.setFillColor(255, 251, 235)
  pdf.setDrawColor(253, 230, 138)
  pdf.roundedRect(left, y, cardWidth, 54, 12, 12, 'FD')
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(146, 64, 14)
  pdf.text('Keep this slip secure. The employee ID is for records, while the portal username and password are used for login.', left + 16, y + 22, { maxWidth: cardWidth - 32 })

  y += 74

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(148, 163, 184)
  pdf.text(`Generated: ${new Date().toLocaleString()}`, left, y)

  pdf.save(buildCredentialSlipFilename(normalized))
}

export function openCredentialSlipPrint(credentials) {
  const printWindow = window.open('', '_blank', 'width=720,height=820')
  if (!printWindow) {
    return false
  }

  printWindow.document.open()
  printWindow.document.write(buildCredentialSlipHtml(credentials, 'print'))
  printWindow.document.close()
  return true
}