// Email service using SendGrid for newsletter automation and user communications

interface Subscriber {
  id: string
  email: string
  name?: string
  subscriptionTier: "free" | "premium"
  subscribedAt: Date
  preferences: {
    dailyNewsletter: boolean
    weeklyDigest: boolean
    breakingNews: boolean
  }
}

export class EmailService {
  private sendGridApiKey: string
  private fromEmail: string

  constructor() {
    this.sendGridApiKey = process.env.SENDGRID_API_KEY || ""
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@flacronsport.com"
  }

  /**
   * Send daily newsletter to all subscribers
   */
  async sendDailyNewsletter(content: string): Promise<void> {
    try {
      // Get all subscribers who opted in for daily newsletter
      const subscribers = await this.getNewsletterSubscribers()

      // Split into free and premium subscribers for different content
      const freeSubscribers = subscribers.filter((sub) => sub.subscriptionTier === "free")
      const premiumSubscribers = subscribers.filter((sub) => sub.subscriptionTier === "premium")

      // Send to free subscribers (with ads and limited content)
      if (freeSubscribers.length > 0) {
        await this.sendBulkEmail(
          freeSubscribers,
          "FlacronSport Daily - Free Edition",
          this.formatFreeNewsletter(content),
        )
      }

      // Send to premium subscribers (ad-free with bonus content)
      if (premiumSubscribers.length > 0) {
        await this.sendBulkEmail(
          premiumSubscribers,
          "FlacronSport Daily - Premium Edition",
          this.formatPremiumNewsletter(content),
        )
      }

      console.log(`Newsletter sent to ${subscribers.length} subscribers`)
    } catch (error) {
      console.error("Error sending daily newsletter:", error)
      throw error
    }
  }

  /**
   * Send welcome email to new subscribers
   */
  async sendWelcomeEmail(subscriber: Subscriber): Promise<void> {
    const welcomeContent = this.formatWelcomeEmail(subscriber)

    await this.sendSingleEmail(subscriber.email, "Welcome to FlacronSport Daily!", welcomeContent)
  }

  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmation(email: string, tier: string): Promise<void> {
    const content = this.formatSubscriptionConfirmation(tier)

    await this.sendSingleEmail(email, "FlacronSport Daily - Subscription Confirmed", content)
  }

  /**
   * Get newsletter subscribers from database
   */
  private async getNewsletterSubscribers(): Promise<Subscriber[]> {
    // Implementation would fetch from Firebase/database
    // This is a mock implementation for now
    return [
      {
        id: "1",
        email: "user@example.com",
        name: "John Doe",
        subscriptionTier: "free",
        subscribedAt: new Date(),
        preferences: {
          dailyNewsletter: true,
          weeklyDigest: true,
          breakingNews: false,
        },
      },
    ]
  }

  /**
   * Send bulk email using SendGrid
   */
  private async sendBulkEmail(subscribers: Subscriber[], subject: string, content: string): Promise<void> {
    try {
      const personalizations = subscribers.map((subscriber) => ({
        to: [{ email: subscriber.email, name: subscriber.name || "" }],
        substitutions: {
          "-name-": subscriber.name || "Sports Fan",
          "-unsubscribe_url-": `https://flacronsport.com/unsubscribe?id=${subscriber.id}`,
        },
      }))

      const emailData = {
        personalizations,
        from: {
          email: this.fromEmail,
          name: "FlacronSport Daily",
        },
        subject,
        content: [
          {
            type: "text/html",
            value: content,
          },
        ],
        tracking_settings: {
          click_tracking: {
            enable: true,
          },
          open_tracking: {
            enable: true,
          },
        },
      }

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.sendGridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SendGrid API error: ${response.status} - ${errorText}`)
      }

      console.log(`Bulk email sent to ${subscribers.length} subscribers`)
    } catch (error) {
      console.error("Error sending bulk email:", error)
      throw error
    }
  }

  /**
   * Send single email using SendGrid
   */
  private async sendSingleEmail(to: string, subject: string, content: string): Promise<void> {
    try {
      const emailData = {
        personalizations: [
          {
            to: [{ email: to }],
          },
        ],
        from: {
          email: this.fromEmail,
          name: "FlacronSport Daily",
        },
        subject,
        content: [
          {
            type: "text/html",
            value: content,
          },
        ],
      }

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.sendGridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SendGrid API error: ${response.status} - ${errorText}`)
      }

      console.log(`Single email sent to ${to}`)
    } catch (error) {
      console.error("Error sending single email:", error)
      throw error
    }
  }

  /**
   * Format welcome email template
   */
  private formatWelcomeEmail(subscriber: Subscriber): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to FlacronSport Daily</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af, #3730a3); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to FlacronSport Daily!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Your daily dose of sports intelligence</p>
        </div>
        
        <div style="padding: 30px; background: white;">
          <h2 style="color: #1e40af; margin-top: 0;">Hi ${subscriber.name || "Sports Fan"}!</h2>
          
          <p>Thank you for subscribing to FlacronSport Daily. You're now part of our community of sports enthusiasts who love staying informed with the latest scores, analysis, and insights.</p>
          
          <h3 style="color: #1e40af;">What you'll receive:</h3>
          <ul style="padding-left: 20px;">
            <li><strong>Daily AI-generated match summaries</strong> - Get comprehensive analysis of yesterday's games</li>
            <li><strong>Live score updates</strong> - Stay current with ongoing matches</li>
            <li><strong>Expert insights</strong> - AI-powered tactical analysis and predictions</li>
            <li><strong>League standings</strong> - Track your favorite teams' progress</li>
          </ul>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #1e40af;">🚀 Your first newsletter arrives tomorrow morning!</h4>
            <p style="margin-bottom: 0;">We'll deliver fresh sports content straight to your inbox every day at 6:00 AM.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://flacronsport.com" style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Visit FlacronSport Daily</a>
          </div>
          
          <p>Questions? Just reply to this email - we'd love to hear from you!</p>
          
          <p style="margin-bottom: 0;">Best regards,<br><strong>The FlacronSport Team</strong></p>
        </div>
        
        <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
          <p style="margin: 0;">© 2024 FlacronSport Daily. All rights reserved.</p>
          <p style="margin: 5px 0 0 0;">
            <a href="-unsubscribe_url-" style="color: #64748b;">Unsubscribe</a> | 
            <a href="https://flacronsport.com/privacy" style="color: #64748b;">Privacy Policy</a>
          </p>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Format subscription confirmation email
   */
  private formatSubscriptionConfirmation(tier: string): string {
    const isPremium = tier === "premium"

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Confirmed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: ${isPremium ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #1e40af, #3730a3)"}; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Subscription Confirmed! 🎉</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">${isPremium ? "Premium" : "Free"} Plan Activated</p>
        </div>
        
        <div style="padding: 30px; background: white;">
          <h2 style="color: #1e40af; margin-top: 0;">Welcome to ${isPremium ? "Premium" : "FlacronSport Daily"}!</h2>
          
          <p>Your ${tier} subscription is now active and ready to go.</p>
          
          <h3 style="color: #1e40af;">You now have access to:</h3>
          <ul style="padding-left: 20px;">
            <li>Daily AI-generated sports summaries</li>
            <li>Live scores and match updates</li>
            <li>League standings and statistics</li>
            ${
              isPremium
                ? `
            <li><strong>Ad-free experience</strong></li>
            <li><strong>Exclusive premium content</strong></li>
            <li><strong>Early access to analysis</strong></li>
            <li><strong>Advanced statistics and insights</strong></li>
            <li><strong>Priority customer support</strong></li>
            `
                : ""
            }
          </ul>
          
          ${
            isPremium
              ? `
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="margin-top: 0; color: #92400e;">🌟 Premium Benefits Active</h4>
            <p style="margin-bottom: 0;">You'll receive enhanced newsletters with exclusive insights and ad-free browsing on our website.</p>
          </div>
          `
              : ""
          }
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://flacronsport.com" style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Exploring</a>
          </div>
          
          <p>Thank you for supporting FlacronSport Daily!</p>
          
          <p style="margin-bottom: 0;">Best regards,<br><strong>The FlacronSport Team</strong></p>
        </div>
        
        <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
          <p style="margin: 0;">© 2024 FlacronSport Daily. All rights reserved.</p>
          <p style="margin: 5px 0 0 0;">
            <a href="https://flacronsport.com/account" style="color: #64748b;">Manage Subscription</a> | 
            <a href="https://flacronsport.com/support" style="color: #64748b;">Support</a>
          </p>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Format newsletter for free subscribers
   */
  private formatFreeNewsletter(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FlacronSport Daily Newsletter</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">FlacronSport Daily</h1>
          <p style="margin: 5px 0 0 0;">Your Daily Sports Update</p>
        </div>
        
        <div style="padding: 20px; background: white;">
          <p style="margin-top: 0;">Hi -name-,</p>
          
          ${content}
          
          <!-- Ad Space for Free Users -->
          <div style="background: #f3f4f6; padding: 20px; margin: 30px 0; text-align: center; border: 2px dashed #d1d5db; border-radius: 8px;">
            <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Advertisement</p>
            <h3 style="margin: 10px 0; color: #1e40af;">Upgrade to Premium</h3>
            <p style="margin: 10px 0; color: #4b5563;">Get ad-free newsletters, exclusive content, and advanced analytics</p>
            <a href="https://flacronsport.com/subscription" style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Upgrade Now - $9.99/month</a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <h3 style="color: #1e40af; margin-bottom: 15px;">Quick Links</h3>
            <p style="margin: 5px 0;"><a href="https://flacronsport.com" style="color: #1e40af; text-decoration: none;">📊 Live Scores</a></p>
            <p style="margin: 5px 0;"><a href="https://flacronsport.com/blog" style="color: #1e40af; text-decoration: none;">📰 Latest News</a></p>
            <p style="margin: 5px 0;"><a href="https://flacronsport.com/subscription" style="color: #1e40af; text-decoration: none;">⭐ Go Premium</a></p>
          </div>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">© 2024 FlacronSport Daily. All rights reserved.</p>
          <p style="margin: 10px 0 0 0;">
            <a href="-unsubscribe_url-" style="color: #6b7280;">Unsubscribe</a> | 
            <a href="https://flacronsport.com" style="color: #6b7280;">Visit Website</a> |
            <a href="https://flacronsport.com/privacy" style="color: #6b7280;">Privacy Policy</a>
          </p>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Format newsletter for premium subscribers
   */
  private formatPremiumNewsletter(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FlacronSport Daily Premium</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af, #3730a3); color: white; padding: 25px; text-align: center;">
          <h1 style="margin: 0; font-size: 26px;">FlacronSport Daily Premium</h1>
          <p style="margin: 5px 0 0 0; color: #bfdbfe;">Exclusive Insights & Analysis</p>
        </div>
        
        <div style="padding: 25px; background: white;">
          <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 15px; margin-bottom: 25px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">🌟 Premium Subscriber Exclusive Content</p>
          </div>
          
          <p style="margin-top: 0;">Hi -name-,</p>
          
          ${content}
          
          <!-- Premium Bonus Content -->
          <div style="background: #eff6ff; padding: 25px; margin: 30px 0; border-radius: 8px; border: 1px solid #bfdbfe;">
            <h3 style="color: #1e40af; margin-top: 0; display: flex; align-items: center;">
              <span style="margin-right: 8px;">📈</span> Premium Insights
            </h3>
            <p style="margin-bottom: 15px;">Advanced statistics, predictions, and exclusive analysis available only to premium subscribers:</p>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Expected Goals (xG) analysis for all matches</li>
              <li>Player performance ratings and heat maps</li>
              <li>AI-powered match predictions for upcoming games</li>
              <li>Tactical breakdown with formation analysis</li>
            </ul>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <h3 style="color: #1e40af; margin-bottom: 15px;">Premium Features</h3>
            <p style="margin: 5px 0;"><a href="https://flacronsport.com/premium/analytics" style="color: #1e40af; text-decoration: none;">📊 Advanced Analytics Dashboard</a></p>
            <p style="margin: 5px 0;"><a href="https://flacronsport.com/premium/predictions" style="color: #1e40af; text-decoration: none;">🔮 AI Match Predictions</a></p>
            <p style="margin: 5px 0;"><a href="https://flacronsport.com/premium/reports" style="color: #1e40af; text-decoration: none;">📋 Custom Team Reports</a></p>
          </div>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">© 2024 FlacronSport Daily Premium. All rights reserved.</p>
          <p style="margin: 10px 0 0 0;">
            <a href="-unsubscribe_url-" style="color: #6b7280;">Unsubscribe</a> | 
            <a href="https://flacronsport.com/account" style="color: #6b7280;">Manage Account</a> |
            <a href="https://flacronsport.com/support" style="color: #6b7280;">Premium Support</a>
          </p>
        </div>
      </body>
      </html>
    `
  }
}

export const emailService = new EmailService()
