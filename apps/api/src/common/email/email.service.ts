import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(EmailService.name);

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.example.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER || 'user',
                pass: process.env.SMTP_PASS || 'pass',
            },
        });
    }

    async sendInvitationEmail(to: string, inviteLink: string) {
        const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Welcome to RetailCraft!</h2>
        <p>You have been invited to join RetailCraft.</p>
        <p>Please click the button below to set up your account and password:</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
        <p>Or copy this link: ${inviteLink}</p>
        <p>This link will expire in 48 hours.</p>
      </div>
    `;

        try {
            if (!process.env.SMTP_HOST) {
                this.logger.warn(`[Mock Email] To: ${to}, Link: ${inviteLink}`);
                return;
            }

            await this.transporter.sendMail({
                from: '"RetailCraft System" <no-reply@retailcraft.com>',
                to,
                subject: 'You have been invited to RetailCraft',
                html,
            });
            this.logger.log(`Invitation email sent to ${to}`);
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}`, error);
            throw error;
        }
    }
}
