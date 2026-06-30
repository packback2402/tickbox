/**
 * Ticket Service Module
 * Handles QR code generation and email notifications for tickets
 */

const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Test email connection on startup
const EMAIL_CONFIGURED = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD && 
  !process.env.EMAIL_USER.includes('example') && 
  !process.env.EMAIL_PASSWORD.includes('placeholder') &&
  !process.env.EMAIL_PASSWORD.includes('your-');

if (EMAIL_CONFIGURED) {
  transporter.verify((error, success) => {
    if (error) {
      console.warn('[Email] [WARN] Email service warning:', error.message);
      console.warn('[Email] [INFO] To enable emails, configure real SMTP credentials in .env');
    } else {
      console.log('[Email] Email service ready');
    }
  });
} else {
  console.log('[INFO] Email service DISABLED - using placeholder credentials. Configure .env to enable.');
}

// ═══════════════════════════════════════════════════════════════════════════
// QR CODE GENERATION WITH ENCRYPTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate encrypted ticket identifier for QR code
 * Format: [ticketId]:[orderItemId]:[hash]
 * Hash ensures integrity and prevents tampering
 */
function generateEncryptedTicketId(ticketId, orderItemId, eventId) {
  const secret = process.env.TICKET_SECRET_KEY || 'tickbox-default-secret-key-change-in-production';
  
  // Create composite identifier
  const identifier = `${ticketId}:${orderItemId}:${eventId}`;
  
  // Create HMAC hash for verification
  const hash = crypto
    .createHmac('sha256', secret)
    .update(identifier)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for brevity
  
  return `${identifier}:${hash}`;
}

/**
 * Verify encrypted ticket identifier
 */
function verifyEncryptedTicketId(encryptedId) {
  const secret = process.env.TICKET_SECRET_KEY || 'tickbox-default-secret-key-change-in-production';
  const parts = encryptedId.split(':');
  
  if (parts.length !== 4) return { valid: false };
  
  const [ticketId, orderItemId, eventId, providedHash] = parts;
  
  // Recalculate hash
  const identifier = `${ticketId}:${orderItemId}:${eventId}`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(identifier)
    .digest('hex')
    .substring(0, 16);
  
  const valid = providedHash === expectedHash;
  
  return {
    valid,
    ticketId: parseInt(ticketId),
    orderItemId: parseInt(orderItemId),
    eventId: parseInt(eventId),
  };
}

/**
 * Generate QR code as Data URL (Base64)
 * QR content: Encrypted ticket ID for verification at venue
 */
async function generateQRCode(ticketId, orderItemId, eventId) {
  try {
    const encryptedId = generateEncryptedTicketId(ticketId, orderItemId, eventId);
    
    // Generate QR code with optimized settings for mobile scanning
    const qrCodeDataUrl = await QRCode.toDataURL(encryptedId, {
      errorCorrectionLevel: 'M', // Medium error correction
      type: 'image/png',
      quality: 0.95,
      margin: 2,
      width: 300, // Medium size for e-ticket
    });
    
    return {
      success: true,
      qrCode: qrCodeDataUrl,
      encryptedId,
    };
  } catch (error) {
    console.error('[QRCode] [ERROR] QR Code generation error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Send ticket confirmation email with QR code
 */
async function sendTicketConfirmationEmail(emailData) {
  const {
    customerEmail,
    customerName,
    eventTitle,
    eventDate,
    eventVenue,
    ticketType,
    quantity,
    orderCode,
    totalAmount,
    tickets = [], // Array of { ticketId, orderItemId, qrCode, encryptedId }
  } = emailData;

  // Format ngày sang tiếng Việt
  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleString('vi-VN', {
        weekday: 'long', year: 'numeric', month: 'long',
        day: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    : 'Chưa có thông tin';

  try {
    // Check if email is properly configured
    if (!EMAIL_CONFIGURED) {
      console.log(`[INFO] Email not configured (test/placeholder credentials). Skipping email send for order ${orderCode}`);
      return { success: true, message: 'Email skipped - not configured' };
    }

    // Generate QR images HTML and attachments
    const attachments = [];

    const ticketsHtml = tickets
      .map((ticket, index) => {
        const cid = `qrcode-${ticket.orderItemId || index}`;
        
        if (ticket.qrCode && ticket.qrCode.startsWith('data:image/')) {
          const base64Data = ticket.qrCode.split(',')[1];
          attachments.push({
            filename: `ticket-qr-${index + 1}.png`,
            content: base64Data,
            encoding: 'base64',
            cid: cid
          });
        }

        return `
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #333; border-radius: 8px; background-color: #242424;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #ffffff;">Vé ${index + 1}/${tickets.length}</p>
          <div style="background-color: white; display: inline-block; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
            <img src="cid:${cid}" alt="QR Code" style="width: 200px; height: 200px; display: block;" />
          </div>
          <p style="margin: 5px 0; font-size: 12px; color: #aaaaaa;">Mã vé: <code style="background-color: #121212; padding: 4px; border-radius: 3px; border: 1px solid #333;">${ticket.encryptedId}</code></p>
        </div>
      `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; line-height: 1.6; background-color: #121212; margin: 0; padding: 20px 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a2a 0%, #0d1a12 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; border-bottom: 2px solid #2CC275; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background-color: #1e1e1e; padding: 20px; border: 1px solid #333; border-top: none; border-radius: 0 0 8px 8px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; color: #2CC275; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333; }
          .label { font-weight: 600; color: #aaaaaa; min-width: 110px; padding-right: 12px; }
          .value { color: #ffffff; }
          .qr-section { text-align: center; margin: 20px 0; padding: 20px; background-color: #121212; border: 1px dashed #333; border-radius: 8px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #333; font-size: 12px; color: #aaaaaa; text-align: center; }
          .alert { background-color: rgba(44, 194, 117, 0.1); border: 1px solid rgba(44, 194, 117, 0.3); padding: 15px; border-radius: 5px; margin: 15px 0; }
          .alert strong { color: #2CC275; }
          .alert ul { margin: 0; padding-left: 20px; color: #aaaaaa; }
          .alert li { margin-bottom: 5px; }
          .button { display: inline-block; background-color: #2CC275; color: #121212; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 10px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Xác Nhận Đặt Vé Thành Công</h1>
          </div>
          
          <div class="content">
            <p>Xin chào <strong style="color: #2CC275;">${customerName}</strong>,</p>
            <p style="color: #aaaaaa;">Cảm ơn bạn đã đặt vé. Dưới đây là chi tiết đơn hàng của bạn:</p>
            
            <div class="section">
              <div class="section-title">Thông Tin Sự Kiện</div>
              <div class="info-row">
                <span class="label">Sự kiện:</span>
                <span class="value"><strong>${eventTitle}</strong></span>
              </div>
              <div class="info-row">
                <span class="label">Ngày:</span>
                <span class="value">${formattedDate}</span>
              </div>
              <div class="info-row">
                <span class="label">Địa điểm:</span>
                <span class="value">${eventVenue}</span>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Thông Tin Vé</div>
              <div class="info-row">
                <span class="label">Loại vé:</span>
                <span class="value">${ticketType}</span>
              </div>
              <div class="info-row">
                <span class="label">Số lượng:</span>
                <span class="value">${quantity} vé</span>
              </div>
              <div class="info-row">
                <span class="label">Mã đơn hàng:</span>
                <span class="value" style="font-weight: bold; color: #2CC275;">${orderCode}</span>
              </div>
              <div class="info-row">
                <span class="label">Tổng tiền:</span>
                <span class="value" style="font-weight: bold; color: #2CC275; font-size: 18px;">${parseFloat(totalAmount).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</span>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Mã QR (E-Ticket)</div>
              <p style="color: #aaaaaa; font-size: 14px;">Lưu hoặc chụp các mã QR dưới đây. Bạn sẽ sử dụng nó để check-in tại sự kiện:</p>
              <div class="qr-section">
                ${ticketsHtml}
              </div>
            </div>
            
            <div class="alert">
              <strong>Lưu ý quan trọng:</strong>
              <ul>
                <li>Chụp ảnh lưu trữ mã QR hoặc tải xuống E-ticket từ tài khoản</li>
                <li>Mang theo vé này (kỹ thuật số hoặc in ra) khi đến sự kiện</li>
                <li>Mỗi mã QR chỉ sử dụng được một lần</li>
              </ul>
            </div>
            
            <div class="section" style="text-align: center;">
              <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-tickets" class="button">Xem Vé Của Tôi</a></p>
            </div>
            
            <div class="footer">
              <p>Nếu bạn có câu hỏi, vui lòng liên hệ với chúng tôi qua support@tickbox.com</p>
              <p>&copy; 2024 TickBox. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"TickBox" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Xác nhận vé: ${eventTitle}`,
      html: htmlContent,
      attachments: attachments
    });

    console.log(`[Email] Confirmation email sent to ${customerEmail}`);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    if (!EMAIL_CONFIGURED) {
      console.log(`[INFO] Email sending skipped for ${customerEmail} (not configured)`);
      return { success: true, message: 'Email skipped - not configured' };
    }
    console.warn(`[Email] [WARN] Email sending error for ${customerEmail}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send reminder email before event
 */
async function sendEventReminderEmail(emailData) {
  const {
    customerEmail,
    customerName,
    eventTitle,
    eventDate,
    eventVenue,
    daysUntilEvent,
  } = emailData;

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; background-color: #121212; margin: 0; padding: 20px 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a2a 0%, #0d1a12 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; border-bottom: 2px solid #2CC275; }
          .header h2 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { background-color: #1e1e1e; padding: 20px; border: 1px solid #333; border-top: none; border-radius: 0 0 8px 8px; line-height: 1.6; }
          p { color: #aaaaaa; }
          strong { color: #ffffff; }
          .highlight { color: #2CC275; font-weight: bold; }
          .button { display: inline-block; background-color: #2CC275; color: #121212; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Nhắc Nhở Sự Kiện</h2>
          </div>
          <div class="content">
            <p>Xin chào <strong class="highlight">${customerName}</strong>,</p>
            <p>Sự kiện <strong>${eventTitle}</strong> sắp diễn ra trong <strong class="highlight">${daysUntilEvent} ngày</strong>!</p>
            <p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;"><strong>Ngày:</strong> ${eventDate}</p>
            <p><strong>Địa điểm:</strong> ${eventVenue}</p>
            <p style="margin-top: 20px;">Vui lòng kiểm tra E-ticket của bạn và chuẩn bị cho sự kiện.</p>
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my-tickets" class="button">Xem Vé Của Tôi</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"TickBox" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Nhắc nhở: ${eventTitle} sắp diễn ra`,
      html: htmlContent,
    });

    console.log(`[Email] Reminder email sent to ${customerEmail}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] [ERROR] Reminder email error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateQRCode,
  generateEncryptedTicketId,
  verifyEncryptedTicketId,
  sendTicketConfirmationEmail,
  sendEventReminderEmail,
};
