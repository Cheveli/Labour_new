import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // port 465 requires secure: true
  auth: {
    user: process.env.SMTP_USER || 'saichevelly@gmail.com',
    pass: process.env.SMTP_PASS || 'sgvw ocnd anot xcdg',
  },
})

interface MailPayload {
  contractorName: string
  mobileNumber: string
  emailAddress: string
  utrNumber: string
  screenshotUrl: string
  registrationDate: string
}

export async function sendAdminNotificationEmail(payload: MailPayload) {
  const mailOptions = {
    from: `"Nirmana System" <${process.env.SMTP_FROM || 'saichevelly@gmail.com'}>`,
    to: 'saichevelly@gmail.com',
    subject: 'New Contractor Registration Request 📝',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #f9f9f9;">
        <h2 style="color: #1a73e8; text-align: center; border-bottom: 2px solid #1a73e8; padding-bottom: 10px;">New Contractor Registration Request</h2>
        <p style="font-size: 16px; color: #333;">A new contractor has registered and submitted payment details for verification.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; width: 40%; color: #555;">Contractor Name:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333;">${payload.contractorName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">Mobile Number:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333;">${payload.mobileNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">Email Address:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333;">${payload.emailAddress}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">UTR Number:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333; font-family: monospace; font-size: 14px;">${payload.utrNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">Registration Date:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333;">${payload.registrationDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">Screenshot Receipt:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333;">
              <a href="${payload.screenshotUrl}" target="_blank" style="color: #1a73e8; text-decoration: underline; font-weight: bold;">View Payment Receipt</a>
            </td>
          </tr>
        </table>
        
        <div style="margin-top: 30px; text-align: center;">
          <p style="font-size: 14px; color: #777;">Please verify the payment and approve or reject this request from your Admin Approval Dashboard.</p>
        </div>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}

interface WelcomePayload {
  contractorName: string
  emailAddress: string
}

export async function sendContractorWelcomeEmail(payload: WelcomePayload) {
  const mailOptions = {
    from: `"Nirmana System" <${process.env.SMTP_FROM || 'saichevelly@gmail.com'}>`,
    to: payload.emailAddress,
    subject: 'Welcome to Nirmana! Your Account is Activated 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #f9f9f9;">
        <h2 style="color: #10b981; text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Welcome to Nirmana Hub</h2>
        <p style="font-size: 16px; color: #333; line-height: 1.5;">Hello <strong>${payload.contractorName}</strong>,</p>
        <p style="font-size: 16px; color: #333; line-height: 1.5;">We are happy to inform you that your subscription payment has been verified, and your contractor account has been <strong>activated successfully</strong>!</p>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; background-color: #f0fdf4; border: 1px dashed #a7f3d0; padding: 12px; border-radius: 8px; margin: 20px 0;">
          <strong>Your account has been activated successfully. You can now login using your registered Mobile Number and verify via OTP.</strong>
        </p>

        <h3 style="color: #1a73e8; margin-top: 25px;">Key Features in Your Dashboard:</h3>
        <ul style="color: #555; line-height: 1.6; padding-left: 20px; font-size: 14px;">
          <li><strong>Workforce Management:</strong> Track daily site crew, roles, and wage rates.</li>
          <li><strong>Attendance Sheets:</strong> Fill daily work logs and track overtime hours.</li>
          <li><strong>Material Management:</strong> Log project inventories, vendor receipts, and material logs.</li>
          <li><strong>Calculation Reports:</strong> Export weekly site calculation reports and subcontractor payouts.</li>
        </ul>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Login to Dashboard</a>
        </div>

        <p style="font-size: 12px; color: #777; margin-top: 35px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
          If you have any questions or require support, please contact our administrator at saichevelly@gmail.com.
        </p>
      </div>
    `,
  }

  return transporter.sendMail(mailOptions)
}

