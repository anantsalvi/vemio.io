/**
 * VEMIO™ — User Invite API
 * POST /api/admin/users/invite
 *
 * Generates a secure invite token, stores it in the users table,
 * and sends a branded email via Azure Communication Services REST API.
 *
 * Body: { userId: "uuid" }   (existing user — send invite)
 *   OR: { email, name, role, tenantId }  (create new user + invite)
 *
 * Requires admin role or MSP.
 */

import { withAuth } from '@/lib/auth';
import { queryAsAdmin } from '@/lib/admin-db';
import crypto from 'crypto';

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== 'admin' && !session.user.isMSP) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  let userId = body.userId;
  let userEmail, userName, userTenantId;

  try {
    if (userId) {
      // Existing user — just generate invite
      const userResult = await queryAsAdmin(
        'SELECT id, email, name, tenant_id FROM users WHERE id = $1',
        [userId]
      );
      if (!userResult.rows.length) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }
      const user = userResult.rows[0];
      userEmail = user.email;
      userName = user.name;
      userTenantId = user.tenant_id;
    } else {
      // Create new user + invite
      const { email, name, role, tenantId } = body;
      if (!email || !name || !role || !tenantId) {
        return Response.json({ error: 'email, name, role, tenantId required' }, { status: 400 });
      }

      // Check duplicate
      const existing = await queryAsAdmin(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      if (existing.rows.length) {
        return Response.json({ error: 'A user with this email already exists' }, { status: 409 });
      }

      // Create user without password
      const newUser = await queryAsAdmin(
        `INSERT INTO users (email, name, role, tenant_id, is_active)
         VALUES (LOWER($1), $2, $3, $4, true)
         RETURNING id`,
        [email, name, role, tenantId]
      );
      userId = newUser.rows[0].id;
      userEmail = email;
      userName = name;
      userTenantId = tenantId;
    }

    // Generate secure invite token (64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    await queryAsAdmin(
      `UPDATE users SET invite_token = $1, invite_expires = $2 WHERE id = $3`,
      [token, expiresAt, userId]
    );

    // Get tenant info for branding
    const tenantResult = await queryAsAdmin(
      'SELECT name, slug, settings FROM tenants WHERE id = $1',
      [userTenantId]
    );
    const tenant = tenantResult.rows[0];
    const brandColor = tenant?.settings?.branding?.primaryColor || '#F59E0B';
    const tenantName = tenant?.name || 'VEMIO';

    // Build invite URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://vemio.vinayenterprises.co.in';
    const inviteUrl = `${baseUrl}/auth/set-password?token=${token}`;

// Send email via ACS
    let emailSent = false;
    try {
      const connStr = process.env.ACS_CONNECTION_STRING;
      const acsSender = process.env.ACS_SENDER_ADDRESS || 'DoNotReply@vinayenterprises.co.in';

      if (connStr) {
        const { EmailClient } = await import('@azure/communication-email');
        const emailClient = new EmailClient(connStr);
        const message = {
          senderAddress: acsSender,
          recipients: { to: [{ address: userEmail, displayName: userName }] },
          content: {
            subject: `You're invited to ${tenantName} on VEMIO`,
            html: buildInviteEmail({ userName, inviteUrl, tenantName, brandColor }),
            plainText: `Hi ${userName},\n\nYou've been invited to ${tenantName} on VEMIO.\nSet your password here: ${inviteUrl}\n\nThis link expires in 48 hours.`,
          },
        };
        const poller = await emailClient.beginSend(message);
        const result = await poller.pollUntilDone();
        console.log(`[VEMIO Invite] Email sent to ${userEmail}: ${result.status}`);
        emailSent = true;
      } else {
        console.warn('[VEMIO Invite] ACS_CONNECTION_STRING not set, skipping email');
      }
    } catch (emailErr) {
      console.error('[VEMIO Invite] Email error:', emailErr.message);
    }

    return Response.json({
      success: true,
      userId,
      inviteUrl,
      expiresAt: expiresAt.toISOString(),
      emailSent,
    });

  } catch (err) {
    console.error('[VEMIO Invite] Error:', err.message);
    return Response.json({ error: 'Failed to create invite' }, { status: 500 });
  }
});


// ── Send invite email via ACS REST API ──
async function sendInviteEmail({ acsEndpoint, acsAccessKey, acsSender, toEmail, toName, inviteUrl, tenantName, brandColor }) {
  const apiVersion = '2023-03-31';
  const url = `${acsEndpoint}/emails:send?api-version=${apiVersion}`;

  // ACS REST API requires HMAC-SHA256 auth
  const body = JSON.stringify({
    senderAddress: acsSender,
    recipients: { to: [{ address: toEmail, displayName: toName }] },
    content: {
      subject: `You're invited to ${tenantName} on VEMIO`,
      html: buildInviteEmail({ userName: toName, inviteUrl, tenantName, brandColor }),
      plainText: `Hi ${toName},\n\nYou've been invited to ${tenantName} on VEMIO.\nSet your password here: ${inviteUrl}\n\nThis link expires in 48 hours.\n\nVEMIO - Network Intelligence Platform`,
    },
  });

  // Use connection string format if available, otherwise use access key directly
  const connStr = process.env.ACS_CONNECTION_STRING;
  if (connStr) {
    // Delegate to a serverless-friendly approach: call our own VPS endpoint
    // or use the connection string with the ACS SDK pattern
    // For now, log the invite URL — email will be sent when ACS SDK is available
    console.log(`[VEMIO Invite] Invite ready for ${toEmail}: ${inviteUrl}`);
    console.log(`[VEMIO Invite] To send via ACS, ensure @azure/communication-email is installed`);

    // Try dynamic import of ACS SDK (works if installed)
    try {
      const { EmailClient } = await import('@azure/communication-email');
      const emailClient = new EmailClient(connStr);
      const message = {
        senderAddress: acsSender,
        recipients: { to: [{ address: toEmail, displayName: toName }] },
        content: {
          subject: `You're invited to ${tenantName} on VEMIO`,
          html: buildInviteEmail({ userName: toName, inviteUrl, tenantName, brandColor }),
          plainText: `Hi ${toName},\n\nYou've been invited to ${tenantName} on VEMIO.\nSet your password here: ${inviteUrl}\n\nThis link expires in 48 hours.`,
        },
      };
      const poller = await emailClient.beginSend(message);
      const result = await poller.pollUntilDone();
      console.log(`[VEMIO Invite] Email sent to ${toEmail}: ${result.status}`);
      return true;
    } catch (sdkErr) {
      // SDK not available — that's okay, invite URL is still returned to admin
      console.warn(`[VEMIO Invite] ACS SDK not available (${sdkErr.message}), email not sent. Admin can share invite URL manually.`);
      return false;
    }
  }

  return false;
}


// ── Branded invite email HTML template ──
function buildInviteEmail({ userName, inviteUrl, tenantName, brandColor }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:24px;">
    <div style="background:#1E293B;border-radius:12px;border:1px solid #334155;overflow:hidden;">
      <div style="background:${brandColor};padding:20px 28px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.8);">You're Invited</div>
        <div style="font-size:22px;font-weight:700;color:#FFF;margin-top:4px;">Welcome to ${tenantName}</div>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;font-size:15px;color:#E2E8F0;line-height:1.6;">Hi ${userName},</p>
        <p style="margin:0 0 20px;font-size:14px;color:#94A3B8;line-height:1.6;">
          You've been invited to access <strong style="color:#E2E8F0;">${tenantName}</strong> on the VEMIO Network Intelligence Platform.
          Click the button below to set your password and activate your account.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${inviteUrl}" style="display:inline-block;padding:14px 36px;background:${brandColor};color:#0A0E17;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.02em;">Set Your Password</a>
        </div>
        <p style="margin:0 0 8px;font-size:12px;color:#64748B;line-height:1.5;">This link will expire in 48 hours. If you didn't expect this invite, you can safely ignore this email.</p>
        <div style="margin-top:16px;padding:12px;background:#0F172A;border-radius:8px;">
          <p style="margin:0 0 4px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Or copy this link:</p>
          <p style="margin:0;font-size:11px;color:#94A3B8;word-break:break-all;font-family:monospace;">${inviteUrl}</p>
        </div>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#475569;margin-top:20px;">VEMIO™ Network Intelligence Platform · Secured by Vinay Enterprises · Est. 1993</p>
  </div>
</body>
</html>`;
}