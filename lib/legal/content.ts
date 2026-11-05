// Published text of the FlacronSport legal package (effective November 4, 2026).
// Wording is reproduced from the owner's document: do not edit it here without
// an updated source document.

export type Block = string | { list: string[] }
export interface PolicySection {
  id: string
  title: string
  blocks: Block[]
}
export interface Policy {
  slug: string
  title: string
  label: string
  sections: PolicySection[]
}

export const EFFECTIVE_DATE = "2026-11-04"
export const LEGAL_INTRO =
  'This policy applies to FlacronSport, operated by Flacron Enterprises LLC ("Flacron," "we," "us," or "our").'

const eula: Policy = {
  slug: "eula",
  title: "End User License Agreement (EULA)",
  label: "EULA",
  sections: [
    { id: "1-1", title: "1.1 Acceptance and License", blocks: ["By downloading, installing, accessing, or using FlacronSport, you agree to this End User License Agreement. Subject to your compliance with this EULA and any applicable subscription terms, Flacron grants you a limited, revocable, non-exclusive, non-transferable, non-sublicensable license to access and use FlacronSport for lawful personal or internal business purposes."] },
    { id: "1-2", title: "1.2 Platform Components", blocks: ["FlacronSport may provide sports schedules, scores, statistics, news, summaries, alerts, personalized feeds, community features, private watch rooms, prediction games without wagering, sports-assistant features, subscription functionality, and links, embeds, or access pathways to authorized third-party video or broadcasters. Features vary by sport, competition, country, provider, device, subscription tier, and release phase."] },
    { id: "1-3", title: "1.3 Media and Broadcast Rights", blocks: [
      "FlacronSport does not grant you ownership of or independent rights to third-party broadcasts, league content, team marks, player likenesses, provider data, or embedded media. Availability of a stream, replay, highlight, or broadcaster link may change at any time. A FlacronSport subscription does not replace any required broadcaster, league, cable, streaming, or pay-per-view subscription unless expressly stated in writing.",
      "You may not download, record, restream, rebroadcast, redistribute, extract, crop, remove branding or advertisements from, or otherwise exploit third-party sports video except where expressly permitted by the applicable rights holder and law.",
    ] },
    { id: "1-4", title: "1.4 Restrictions", blocks: [{ list: [
      "Do not reverse engineer, decompile, defeat DRM, bypass geographic restrictions, circumvent access controls, or attempt to obtain unauthorized media access.",
      "Do not scrape, harvest, reproduce, resell, or systematically extract sports data, articles, scores, statistics, or media except through an expressly authorized API or written agreement.",
      "Do not use bots or automation to create accounts, manipulate community interactions, abuse prediction systems, evade rate limits, or interfere with platform operations.",
      "Do not impersonate Flacron, a broadcaster, league, team, athlete, moderator, or another user.",
      "Do not upload unlawful, infringing, defamatory, harassing, hateful, threatening, sexually exploitative, fraudulent, or malicious content.",
    ] }] },
    { id: "1-5", title: "1.5 Updates, Availability, and Termination", blocks: ["Flacron may update, modify, suspend, remove, or discontinue features, competitions, sports, providers, video options, community tools, or APIs when necessary for security, licensing, legal, commercial, or operational reasons. We may suspend or terminate access for material violations, fraud, abuse, chargebacks, infringement, safety risks, or legal requirements."] },
    { id: "1-6", title: "1.6 Ownership", blocks: ["Flacron and its licensors retain all rights in FlacronSport, including software, interface designs, original text, trademarks, graphics, databases, code, generated summaries, and other proprietary materials, excluding third-party content owned by its respective rights holders."] },
    { id: "1-7", title: "1.7 Third-Party Terms", blocks: ["Third-party players, data feeds, broadcasters, app stores, payment providers, analytics vendors, email providers, and other integrations may impose separate terms. You are responsible for complying with those terms when using their services through or alongside FlacronSport."] },
    { id: "1-8", title: "1.8 Warranty Disclaimer", blocks: ['THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" TO THE MAXIMUM EXTENT PERMITTED BY LAW. FLACRON DOES NOT WARRANT THAT SCORES, STATISTICS, SCHEDULES, VIDEO AVAILABILITY, NEWS, GENERATED SUMMARIES, ALERTS, OR PREDICTIONS WILL ALWAYS BE COMPLETE, ACCURATE, TIMELY, UNINTERRUPTED, OR ERROR-FREE.'] },
    { id: "1-9", title: "1.9 Limitation of Liability", blocks: ["TO THE MAXIMUM EXTENT PERMITTED BY LAW, FLACRON AND ITS AFFILIATES, OFFICERS, EMPLOYEES, CONTRACTORS, LICENSORS, AND PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, CONSEQUENTIAL, OR PUNITIVE DAMAGES; LOSS OF DATA, PROFITS, REVENUE, GOODWILL, OR OPPORTUNITY; MISSED EVENTS; FAILED PLAYBACK; OR RELIANCE ON SCORES, PREDICTIONS, NEWS, OR GENERATED CONTENT. WHERE LIABILITY CANNOT BE EXCLUDED, OUR AGGREGATE LIABILITY WILL NOT EXCEED THE AMOUNT YOU PAID TO FLACRONSPORT DURING THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR $100 IF YOU PAID NOTHING, SUBJECT TO APPLICABLE LAW."] },
    { id: "1-10", title: "1.10 Governing Law", blocks: ["This EULA is governed by the laws of the State of New York, without regard to conflict-of-law principles, except where mandatory consumer law requires otherwise."] },
  ],
}

const privacy: Policy = {
  slug: "privacy-policy",
  title: "Privacy Policy",
  label: "Privacy Policy",
  sections: [
    { id: "2-1", title: "2.1 Information We Collect", blocks: ["Depending on how you use FlacronSport, we may collect:", { list: [
      "Account information such as name, email address, authentication identifiers, language, time zone, and account status.",
      "Preferences including favorite sports, teams, leagues, athletes, spoiler settings, alert preferences, theme, language, and saved content.",
      "Subscription and billing metadata, such as plan, transaction identifiers, renewal status, refunds, and entitlement history. Payment card data is generally handled by the payment processor rather than stored directly by Flacron.",
      "Device, browser, IP address, approximate location inferred from network information, operating system, app version, identifiers, logs, crash data, and security events.",
      "Usage information such as pages viewed, matches opened, viewing-option checks, video starts, playback errors, alerts, searches, assistant requests, article interactions, and feature usage.",
      "Community information including chat messages, reactions, room memberships, reports, moderation actions, and blocked-user relationships.",
      "Prediction entries and points in non-wagering prediction features.",
      "Communications with support, feedback, correction requests, and marketing preferences.",
    ] }] },
    { id: "2-2", title: "2.2 How We Use Information", blocks: [{ list: [
      "Provide scores, fixtures, personalized feeds, viewing options, alerts, news, community features, subscriptions, and support.",
      "Enforce geographic, entitlement, provider, safety, moderation, and anti-abuse rules.",
      "Personalize recommendations and prioritize favorite sports, competitions, teams, and athletes.",
      "Generate source-grounded summaries and answer sports-assistant questions.",
      "Process billing, renewals, cancellations, refunds, and fraud prevention.",
      "Monitor reliability, provider freshness, playback errors, usage, security incidents, and abuse.",
      "Improve features, measure engagement, conduct analytics, and test product changes.",
      "Send service communications and, where permitted, marketing or newsletters based on your preferences and consent.",
    ] }] },
    { id: "2-3", title: "2.3 Legal Bases", blocks: ["Where applicable, we process information to perform our contract with you, pursue legitimate interests such as security and service improvement, comply with legal obligations, and rely on consent where required for optional communications, cookies, tracking, or certain location-related features."] },
    { id: "2-4", title: "2.4 Sports Viewing and Territory Information", blocks: ["To determine whether a viewing option is permitted in your country or region, FlacronSport or its providers may use IP-derived location, account country, device settings, or other permitted territory signals. A profile preference cannot override licensing restrictions. We do not promise that a video available in one location will be available elsewhere."] },
    { id: "2-5", title: "2.5 Community Content", blocks: ["Public chat messages, reactions, usernames, and certain profile information may be visible to other users. Private watch-room content is limited to authorized room participants but may still be reported, reviewed for moderation, retained for safety, or disclosed when legally required. Do not post information you do not want other permitted participants to see."] },
    { id: "2-6", title: "2.6 Generated Content and Sports Assistant", blocks: ["Prompts and platform context submitted to sports-assistant or automated-summary features may be processed by Flacron and approved model providers. We aim to minimize personal information and use provider settings consistent with our agreements. Do not submit highly sensitive personal data unless specifically requested for a supported purpose."] },
    { id: "2-7", title: "2.7 Sharing", blocks: ["We may share information with hosting, authentication, payment, analytics, email, notification, moderation, customer-support, data, media, model, fraud-prevention, and security providers as necessary to operate FlacronSport. We may also disclose information to professional advisers, authorities, courts, or transaction counterparties when legally required or in connection with a corporate transaction."] },
    { id: "2-8", title: "2.8 Third-Party Broadcasters and Links", blocks: ["When you open a third-party broadcaster, embedded player, league site, ticket seller, merchandise partner, or affiliate, that third party may collect data under its own privacy policy. Flacron does not control third-party privacy practices."] },
    { id: "2-9", title: "2.9 Retention", blocks: ["We retain information for as long as reasonably necessary for the purposes described here, including account operation, billing, fraud prevention, moderation, dispute resolution, legal obligations, and security. Community enforcement records, payment records, and audit logs may be retained longer where necessary."] },
    { id: "2-10", title: "2.10 Your Rights and Choices", blocks: ["Depending on your jurisdiction, you may have rights to access, correct, delete, restrict, object to, or receive a portable copy of certain personal information, and to opt out of certain targeted advertising, sale, sharing, or marketing communications. You may also manage many preferences in your account. Requests may require identity verification."] },
    { id: "2-11", title: "2.11 Children and Minors", blocks: ["FlacronSport is not directed to children under 13 in the United States, and we do not knowingly collect personal information from children under the applicable minimum digital-consent age without required authorization. Community and account features may be restricted by age. If we learn that prohibited child data was collected, we will take appropriate steps to delete or restrict it."] },
    { id: "2-12", title: "2.12 Security", blocks: ["We use administrative, technical, and organizational safeguards such as encryption in transit, access controls, authentication, logging, environment separation, secrets management, moderation controls, and monitoring. No system is completely secure, and we cannot guarantee absolute security."] },
    { id: "2-13", title: "2.13 International Transfers", blocks: ["Information may be processed in countries different from your own. Where required, we use appropriate safeguards for international data transfers and review provider arrangements before expanding into new jurisdictions."] },
    { id: "2-14", title: "2.14 Contact", blocks: ["Privacy questions and requests may be sent to contact@flacronenterprises.com or mailed to Flacron Enterprises LLC, 410 E 95th St, Brooklyn, NY 11212, United States."] },
  ],
}

const terms: Policy = {
  slug: "terms-of-service",
  title: "Terms of Service",
  label: "Terms of Service",
  sections: [
    { id: "3-1", title: "3.1 Eligibility and Accounts", blocks: ["You must be legally capable of entering into a binding agreement and meet any applicable age requirements. You are responsible for accurate account information, maintaining credential security, and all activity under your account. Accounts may not be sold, transferred, or shared to evade plan or access restrictions."] },
    { id: "3-2", title: "3.2 Sports Data, Scores, and News", blocks: ["Scores, schedules, statistics, lineups, standings, event status, news, and other sports information may come from third-party providers, official sources, publishers, or generated summaries. Data can be delayed, corrected, incomplete, or unavailable. Users should verify critical information with the official competition, team, league, governing body, broadcaster, or event organizer."] },
    { id: "3-3", title: "3.3 Video and Viewing Options", blocks: ["FlacronSport may display an authorized embedded player, public embed, replay, highlight, or link to an official broadcaster where permitted. Access may depend on territory, event window, device, provider availability, user entitlement, and an independent third-party subscription. Flacron may remove or disable a video option immediately if authorization, availability, territory, or provider conditions change."] },
    { id: "3-4", title: "3.4 Subscription Plans", blocks: [
      "FlacronSport may offer Free, Plus, and Premium tiers. At launch planning, Plus is listed at $6.99/month or $59.99/year and Premium at $12.99/month or $119.99/year. Prices, taxes, features, and availability may change prospectively with notice where required. Annual plans are charged upfront and renew annually unless canceled.",
      "Subscription fees pay for FlacronSport features and entitlements only. They do not guarantee access to every match, league, team, country, broadcast, replay, or broadcaster service.",
    ] },
    { id: "3-5", title: "3.5 Add-Ons", blocks: ["Optional one-time add-ons may include extra sports-assistant requests, a Premium day pass, private-room passes, and report-export packs. Add-ons may expire, may require an underlying live feature, and do not automatically renew unless expressly stated. Add-ons never provide universal broadcast rights."] },
    { id: "3-6", title: "3.6 Billing and Renewals", blocks: ["Paid subscriptions automatically renew at the applicable billing interval unless canceled before renewal. By purchasing, you authorize the applicable payment provider to charge the payment method on file. Taxes may apply. Failed payments may result in loss or suspension of paid entitlements after the already-paid period or any stated grace period."] },
    { id: "3-7", title: "3.7 Community Rules", blocks: ["Community features are intended for lawful sports discussion and fan interaction. Users must not harass, threaten, stalk, dox, impersonate, discriminate against, exploit, spam, defraud, or encourage violence against others. Users must not post pirated streams, illegal download links, malicious code, or content that infringes intellectual-property rights. Flacron may remove content and mute, suspend, or ban accounts based on moderation rules and safety needs."] },
    { id: "3-8", title: "3.8 Private Watch Rooms", blocks: ["A private watch room shares conversation and match context; it does not rebroadcast the host's video. Every participant must independently satisfy any viewing entitlement or geographic restriction. Invitation links may be revoked, participant limits apply, and room creators may be responsible for managing invited participants subject to Flacron moderation."] },
    { id: "3-9", title: "3.9 Predictions and No Gambling", blocks: ["Initial FlacronSport prediction features are entertainment-only, points-based activities with no deposits, wagers, cash prizes, purchased chances, or cash-out. FlacronSport is not a sportsbook, gambling operator, or betting service. Any future prize or paid-entry feature would require separate rules and legal review before launch."] },
    { id: "3-10", title: "3.10 User Content License", blocks: ["You retain ownership of content you submit, but grant Flacron a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, transmit, moderate, and process that content solely as reasonably necessary to operate, secure, improve, and enforce FlacronSport. You represent that you have the rights needed to provide your content."] },
    { id: "3-11", title: "3.11 Intellectual Property Complaints", blocks: ["If you believe content on FlacronSport infringes your copyright or other rights, contact us with sufficient detail to identify the work, the allegedly infringing material, your contact information, and a good-faith statement regarding the claim. We may remove or restrict content while reviewing the matter."] },
    { id: "3-12", title: "3.12 Affiliate and Sponsored Content", blocks: ["FlacronSport may display clearly identified sponsorships, advertising, ticket links, or merchandise affiliate links. We may receive compensation if you interact with or purchase through certain links. Third-party purchases are governed by the seller's terms."] },
    { id: "3-13", title: "3.13 Prohibited Conduct", blocks: [{ list: [
      "Circumventing paywalls, DRM, geographic blocks, subscription checks, or provider access controls.",
      "Uploading or sharing pirated streams or unauthorized broadcast links.",
      "Using the platform for wagering, money laundering, illegal gambling, or prohibited prize schemes.",
      "Manipulating prediction points, referrals, votes, polls, or community metrics.",
      "Automated scraping, bulk extraction, resale, or redistribution of sports data or generated content without permission.",
      "Interfering with platform security, APIs, billing, moderation, or provider integrations.",
    ] }] },
    { id: "3-14", title: "3.14 Suspension and Termination", blocks: ["We may suspend or terminate accounts, features, or access where reasonably necessary for legal compliance, licensing, security, safety, fraud prevention, payment failure, provider restrictions, or violation of these Terms. You remain responsible for amounts already due."] },
    { id: "3-15", title: "3.15 Dispute Resolution", blocks: ["Before filing a formal claim, you and Flacron agree to attempt good-faith informal resolution for at least 30 days by written notice. To the extent permitted by law, disputes will be resolved individually and not on a class or representative basis. Any arbitration clause or class-waiver provision will apply only where enforceable and not where mandatory consumer law provides otherwise. You may opt out of arbitration by written notice within 30 days after first accepting these Terms."] },
    { id: "3-16", title: "3.16 Governing Law", blocks: ["These Terms are governed by New York law, subject to mandatory consumer-protection laws that may apply based on your residence."] },
  ],
}

const refunds: Policy = {
  slug: "refund-policy",
  title: "Cancellation & Refund Policy",
  label: "Cancellation & Refunds",
  sections: [
    { id: "4-1", title: "4.1 Subscription Cancellation", blocks: ["You may cancel a recurring FlacronSport subscription through the available account billing controls or the payment platform used for purchase. Unless otherwise required by law or expressly stated, cancellation takes effect at the end of the current paid billing period, and you retain paid features until that date."] },
    { id: "4-2", title: "4.2 Renewal Charges", blocks: ["To avoid a renewal charge, cancel before the renewal is processed. Annual subscriptions are billed for the full annual term upfront. We may send renewal notices where required by law or business practice, but your responsibility to manage renewal is not conditioned on receiving a reminder unless applicable law says otherwise."] },
    { id: "4-3", title: "4.3 Refund Eligibility", blocks: ["Except where required by law, subscription and add-on charges are generally non-refundable after the applicable service or entitlement has been provided. However, Flacron may issue full or partial refunds in its discretion for duplicate charges, verified billing errors, material platform failures, unauthorized transactions after review, or other exceptional circumstances."] },
    { id: "4-4", title: "4.4 No Refund for Broadcast Availability Changes", blocks: ["Because sports rights and third-party video availability can change by event, territory, provider, device, and time, a specific match becoming unavailable does not automatically entitle a user to a refund where the FlacronSport subscription otherwise remains usable. This does not limit rights provided by applicable consumer law."] },
    { id: "4-5", title: "4.5 Add-On Refunds", blocks: ["For one-time add-ons, unused entitlements may be revoked if a refund is granted. If credits, room access, or other benefits were already consumed, we may deny or prorate the refund except where required by law. Refunds do not restore expired access periods."] },
    { id: "4-6", title: "4.6 App Store Purchases", blocks: ["If future native-app purchases are processed through Apple, Google, or another app store, refunds may be governed by that store's rules and request process. Flacron may not be able to directly issue refunds for store-controlled transactions."] },
    { id: "4-7", title: "4.7 Chargebacks", blocks: ["Before initiating a chargeback, please contact us so we can investigate. Fraudulent or abusive chargebacks may result in account suspension. Nothing here prevents lawful dispute rights with your payment provider."] },
    { id: "4-8", title: "4.8 Contact for Billing", blocks: ["Billing and refund requests may be sent to contact@flacronenterprises.com. Include the account email, transaction date, amount, and a short description of the issue. Do not send full payment-card numbers."] },
  ],
}

const disclaimer: Policy = {
  slug: "disclaimer",
  title: "General Disclaimer",
  label: "Disclaimer",
  sections: [
    { id: "5-1", title: "5.1 Sports Information", blocks: ["FlacronSport provides sports information for general informational and entertainment purposes. Scores, schedules, statistics, participants, injuries, availability, standings, event status, and news can change or be corrected. Flacron does not guarantee real-time accuracy or completeness."] },
    { id: "5-2", title: "5.2 Broadcast and Streaming Disclaimer", blocks: ["FlacronSport is not a promise of universal live sports access. Video is shown only where a provider, broadcaster, league, rights holder, or authorized public embed permits it. Territory restrictions, blackout rules, subscriptions, authentication, DRM, concurrency limits, device compatibility, ad requirements, and provider outages may apply."] },
    { id: "5-3", title: "5.3 Generated Summaries and Assistant", blocks: ["Automated summaries and sports-assistant responses may contain errors, omissions, or outdated information despite source-grounding controls. Generated content should not be treated as an official league record, official ruling, professional advice, or guaranteed prediction. Official sources control when there is a conflict."] },
    { id: "5-4", title: "5.4 No Betting or Financial Advice", blocks: ["Predictions, comparisons, statistics, trends, and assistant responses are not gambling, betting, investment, or financial advice and are not intended to predict outcomes with certainty. FlacronSport does not guarantee winnings, performance, or future results."] },
    { id: "5-5", title: "5.5 Third Parties", blocks: ["References to leagues, teams, players, broadcasters, sponsors, vendors, ticket sellers, merchandise providers, or data companies do not imply endorsement or partnership unless expressly stated. Third-party names and marks belong to their respective owners."] },
    { id: "5-6", title: "5.6 Community Content", blocks: ["User comments and community discussions reflect users' views, not Flacron's. We moderate for safety and policy compliance but cannot review every message before publication. Use reporting tools for problematic content."] },
    { id: "5-7", title: "5.7 External Links and Purchases", blocks: ["Flacron is not responsible for third-party websites, products, tickets, merchandise, subscriptions, or transactions. Review the third party's terms, refund policy, privacy policy, and availability before purchase."] },
    { id: "5-8", title: "5.8 Service Interruptions", blocks: ["Live sports products depend on external feeds, networks, clouds, broadcasters, and device capabilities. Temporary delays, outages, stale data, missing highlights, broken embeds, and schedule changes can occur. We may provide fallback scores, links, or status messages rather than video."] },
  ],
}

export const COOKIE_CATEGORIES = [
  { id: "necessary", name: "Strictly Necessary", text: "Authentication, session security, load balancing, fraud prevention, billing state, consent records, and required preferences." },
  { id: "functional", name: "Functional", text: "Language, theme, favorite-team filters, spoiler settings, remembered navigation, low-data mode, and similar user choices." },
  { id: "analytics", name: "Analytics", text: "Page usage, feature adoption, playback attempts, error measurement, performance, conversion, and aggregated product analytics." },
  { id: "advertising", name: "Advertising or Affiliate", text: "Measurement, sponsorship, referral attribution, or personalized advertising where used and legally permitted. Consent will be requested where required." },
] as const

const cookies: Policy = {
  slug: "cookie-policy",
  title: "Cookies Policy",
  label: "Cookies Policy",
  sections: [
    { id: "6-1", title: "6.1 What Cookies Are", blocks: ["Cookies and similar technologies are small files, browser storage, pixels, SDK identifiers, or local-storage entries used to remember preferences, keep users signed in, secure accounts, measure usage, and support platform functionality."] },
    { id: "6-2", title: "6.2 Categories We May Use", blocks: COOKIE_CATEGORIES.map((category) => `${category.name}: ${category.text}`) },
    { id: "6-3", title: "6.3 Third-Party Technologies", blocks: ["Approved payment, analytics, media, embedded-video, advertising, support, authentication, and other providers may set or access their own technologies. Embedded players can be subject to the provider's own cookie and privacy practices."] },
    { id: "6-4", title: "6.4 Your Choices", blocks: ["Where required, FlacronSport will provide consent controls for non-essential technologies. You may also use browser or device settings to block or delete cookies. Blocking necessary technologies can prevent sign-in, billing, media playback, or other features from working correctly."] },
    { id: "6-5", title: "6.5 Do Not Track and Similar Signals", blocks: ["Browser privacy signals are handled according to applicable law and supported technical standards. Where legally required, Flacron will honor recognized opt-out preference signals for applicable processing."] },
    { id: "6-6", title: "6.6 Updates", blocks: ["We may update this Cookies Policy when providers, technologies, laws, or features change. Material changes will be communicated as appropriate."] },
    { id: "6-7", title: "6.7 Contact", blocks: ["Questions about cookies and tracking may be sent to contact@flacronenterprises.com."] },
  ],
}

export const POLICIES: Policy[] = [terms, privacy, eula, refunds, disclaimer, cookies]

export function getPolicy(slug: string): Policy | undefined {
  return POLICIES.find((policy) => policy.slug === slug)
}
