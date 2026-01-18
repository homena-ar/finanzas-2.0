// Templates profesionales de correos electrónicos para FinControl

export interface EmailPermissions {
  gastos: string
  ingresos: string
  ahorros: string
  tarjetas: string
}

export function getInvitationEmailTemplate(
  workspaceName: string,
  email: string,
  permissions: EmailPermissions,
  inviterName?: string
): { html: string; text: string; subject: string } {
  const permissionLabels: Record<string, string> = {
    'ninguno': 'Sin acceso',
    'solo_lectura': 'Solo lectura',
    'solo_propios': 'Solo propios',
    'ver_todo_agregar_propio': 'Ver todo, agregar propios',
    'admin': 'Administrador',
    // Aliases para compatibilidad
    'lectura': 'Solo lectura',
    'escritura': 'Lectura y escritura',
    'read': 'Solo lectura',
    'write': 'Lectura y escritura'
  }

  const getPermissionLabel = (perm: string) => {
    return permissionLabels[perm.toLowerCase()] || perm
  }

  const subject = `Invitación a ${workspaceName} - FinControl`

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                🎉 ¡Te invitaron a colaborar!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                ${inviterName ? `Hola,<br><br><strong>${inviterName}</strong> te ha invitado a colaborar en el workspace <strong style="color: #6366f1;">${workspaceName}</strong> en FinControl.` : `Has sido invitado a colaborar en el workspace <strong style="color: #6366f1;">${workspaceName}</strong> en FinControl.`}
              </p>

              <!-- Permisos Section -->
              <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border-radius: 8px; padding: 24px; margin: 30px 0; border-left: 4px solid #6366f1;">
                <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                  📋 Permisos asignados
                </h2>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">💰 Gastos</td>
                    <td align="right" style="padding: 8px 0;">
                      <span style="background-color: #6366f1; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                        ${getPermissionLabel(permissions.gastos)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">💵 Ingresos</td>
                    <td align="right" style="padding: 8px 0;">
                      <span style="background-color: #6366f1; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                        ${getPermissionLabel(permissions.ingresos)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">🏦 Ahorros</td>
                    <td align="right" style="padding: 8px 0;">
                      <span style="background-color: #6366f1; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                        ${getPermissionLabel(permissions.ahorros)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">💳 Tarjetas</td>
                    <td align="right" style="padding: 8px 0;">
                      <span style="background-color: #6366f1; color: #ffffff; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                        ${getPermissionLabel(permissions.tarjetas)}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Instructions -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 16px; font-weight: 600;">
                  📝 Cómo aceptar la invitación
                </h3>
                <ol style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">Inicia sesión en FinControl con tu email: <strong style="color: #6366f1;">${email}</strong></li>
                  <li style="margin-bottom: 8px;">Ve a la página de <strong>Configuración</strong></li>
                  <li style="margin-bottom: 8px;">Verás la invitación pendiente y podrás aceptarla</li>
                </ol>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://fin.nexuno.com.ar'}/dashboard/config" 
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);">
                  Ver Invitación
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                Este es un email automático de <strong style="color: #6366f1;">FinControl</strong>.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                Si no esperabas esta invitación, puedes ignorar este mensaje de forma segura.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `¡Te invitaron a colaborar!

Has sido invitado a colaborar en ${workspaceName} en FinControl.

Permisos asignados:
- Gastos: ${getPermissionLabel(permissions.gastos)}
- Ingresos: ${getPermissionLabel(permissions.ingresos)}
- Ahorros: ${getPermissionLabel(permissions.ahorros)}
- Tarjetas: ${getPermissionLabel(permissions.tarjetas)}

Para aceptar la invitación:
1. Inicia sesión en FinControl con tu email: ${email}
2. Ve a la página de Configuración
3. Verás la invitación pendiente y podrás aceptarla

${process.env.NEXT_PUBLIC_APP_URL || 'https://fin.nexuno.com.ar'}/dashboard/config

Este es un email automático de FinControl. Si no esperabas esta invitación, puedes ignorar este mensaje.`

  return { html, text, subject }
}

export function getWelcomeEmailTemplate(
  userName: string,
  userEmail: string
): { html: string; text: string; subject: string } {
  const subject = '¡Bienvenido a FinControl! 🎉'

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                🎉 ¡Bienvenido a FinControl!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Hola <strong>${userName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                ¡Estamos emocionados de tenerte en FinControl! Tu cuenta ha sido creada exitosamente y ya puedes comenzar a gestionar tus finanzas personales o familiares.
              </p>

              <!-- Features -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; padding: 24px; margin: 30px 0; border-left: 4px solid #10b981;">
                <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                  ✨ Comienza a usar FinControl
                </h2>
                <ul style="margin: 0; padding-left: 20px; color: #065f46; font-size: 14px; line-height: 1.8;">
                  <li style="margin-bottom: 10px;"><strong>💰 Gastos:</strong> Registra y categoriza tus gastos fácilmente</li>
                  <li style="margin-bottom: 10px;"><strong>💵 Ingresos:</strong> Lleva un control de tus ingresos</li>
                  <li style="margin-bottom: 10px;"><strong>🏦 Ahorros:</strong> Gestiona tus metas de ahorro</li>
                  <li style="margin-bottom: 10px;"><strong>💳 Tarjetas:</strong> Organiza tus tarjetas de crédito</li>
                  <li style="margin-bottom: 10px;"><strong>📊 Resúmenes:</strong> Visualiza tus finanzas con gráficos y proyecciones</li>
                </ul>
              </div>

              <!-- Important -->
              <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px; font-weight: 600;">
                  🔐 Confirma tu email
                </h3>
                <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.6;">
                  Para asegurar la seguridad de tu cuenta, por favor confirma tu dirección de email haciendo clic en el enlace que te enviamos por separado.
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://fin.nexuno.com.ar'}/dashboard" 
                   style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                  Comenzar ahora
                </a>
              </div>

              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Si tienes alguna pregunta, no dudes en contactarnos. Estamos aquí para ayudarte.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                <strong style="color: #10b981;">FinControl</strong> - Gestiona tus finanzas de forma inteligente
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                Este es un email automático. Por favor, no respondas a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `¡Bienvenido a FinControl! 🎉

Hola ${userName},

¡Estamos emocionados de tenerte en FinControl! Tu cuenta ha sido creada exitosamente y ya puedes comenzar a gestionar tus finanzas personales o familiares.

Comienza a usar FinControl:
- 💰 Gastos: Registra y categoriza tus gastos fácilmente
- 💵 Ingresos: Lleva un control de tus ingresos
- 🏦 Ahorros: Gestiona tus metas de ahorro
- 💳 Tarjetas: Organiza tus tarjetas de crédito
- 📊 Resúmenes: Visualiza tus finanzas con gráficos y proyecciones

🔐 Confirma tu email
Para asegurar la seguridad de tu cuenta, por favor confirma tu dirección de email haciendo clic en el enlace que te enviamos por separado.

${process.env.NEXT_PUBLIC_APP_URL || 'https://fin.nexuno.com.ar'}/dashboard

Si tienes alguna pregunta, no dudes en contactarnos. Estamos aquí para ayudarte.

FinControl - Gestiona tus finanzas de forma inteligente`

  return { html, text, subject }
}

export function getEmailVerificationTemplate(
  userName: string,
  verificationLink: string
): { html: string; text: string; subject: string } {
  const subject = 'Confirma tu email - FinControl'

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                🔐 Confirma tu email
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Hola <strong>${userName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Gracias por registrarte en FinControl. Para completar tu registro y asegurar la seguridad de tu cuenta, por favor confirma tu dirección de email.
              </p>

              <!-- Security Info -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px; font-weight: 600;">
                  🔒 ¿Por qué confirmar tu email?
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">Asegura que el email es válido y te pertenece</li>
                  <li style="margin-bottom: 8px;">Permite recuperar tu cuenta si olvidas tu contraseña</li>
                  <li style="margin-bottom: 8px;">Recibirás notificaciones importantes sobre tu cuenta</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                  Confirmar mi email
                </a>
              </div>

              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin: 10px 0 0 0; color: #3b82f6; font-size: 12px; word-break: break-all;">
                ${verificationLink}
              </p>

              <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 15px; margin: 30px 0;">
                <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.6;">
                  <strong>⚠️ Importante:</strong> Este enlace expirará en 24 horas. Si no solicitaste esta confirmación, puedes ignorar este email de forma segura.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                <strong style="color: #3b82f6;">FinControl</strong> - Gestiona tus finanzas de forma inteligente
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                Este es un email automático. Por favor, no respondas a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `Confirma tu email - FinControl

Hola ${userName},

Gracias por registrarte en FinControl. Para completar tu registro y asegurar la seguridad de tu cuenta, por favor confirma tu dirección de email.

¿Por qué confirmar tu email?
- Asegura que el email es válido y te pertenece
- Permite recuperar tu cuenta si olvidas tu contraseña
- Recibirás notificaciones importantes sobre tu cuenta

Confirma tu email haciendo clic en este enlace:
${verificationLink}

⚠️ Importante: Este enlace expirará en 24 horas. Si no solicitaste esta confirmación, puedes ignorar este email de forma segura.

FinControl - Gestiona tus finanzas de forma inteligente`

  return { html, text, subject }
}
