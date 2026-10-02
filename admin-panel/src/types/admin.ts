export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FINANCE_ADMIN'
  | 'ANALYTICS_ADMIN'
  | 'MARKETING_ADMIN'
  | 'CONTENT_ADMIN'
  | 'SUPPORT_ADMIN'
  | 'DEVELOPER'
  | 'VIEWER';

export type AdminPermission =
  | 'analytics.view'
  | 'analytics.export'
  | 'finance.view'
  | 'finance.export'
  | 'finance.refund'
  | 'users.view'
  | 'users.edit'
  | 'users.delete'
  | 'gtm.view'
  | 'gtm.edit'
  | 'gtm.publish'
  | 'features.view'
  | 'features.edit'
  | 'ai.view'
  | 'ai.configure'
  | 'notifications.view'
  | 'notifications.create'
  | 'notifications.send'
  | 'settings.view'
  | 'settings.edit'
  | 'audit.view';

export interface AdminUserSession {
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  loginTime: string;
  lastActive: string;
  isSuspicious: boolean;
  isCurrent: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  customPermissions: AdminPermission[];
  avatarUrl?: string;
  twoFactorEnabled: boolean;
  lastLogin: string;
  status: 'active' | 'suspended' | 'pending';
  activeSessions: AdminUserSession[];
}

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | '6m'
  | '12m'
  | 'custom';

export interface ExecutiveKPIs {
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  returningUsers: number;
  sessions: number;
  engagementRate: number; // percentage e.g. 78.4
  retentionD1: number;
  retentionD7: number;
  retentionD30: number;
  remindersCreated: number;
  remindersCompleted: number;
  remindersMissed: number;
  activeSubscriptions: number;
  newSubscriptions: number;
  trialUsers: number;
  trialConversionRate: number;
  mrr: number; // in INR
  arr: number;
  revenue: number;
  refunds: number;
  churnRate: number;
  arpu: number;
  cac: number;
  ltv: number;
  apiCostsUSD: number;
  errorRate: number;
  crashRate: number;
}

export interface GA4AnalyticsData {
  realtimeUsers: number;
  totalUsers: number;
  newUsers: number;
  sessions: number;
  engagementRate: number;
  avgEngagementTime: string;
  screenViews: number;
  eventsCount: number;
  conversionsCount: number;
  revenueUSD: number;
  acquisitionChannels: { channel: string; users: number; percentage: number }[];
  sourceMedium: { source: string; users: number; conversions: number }[];
  topCampaigns: { campaign: string; users: number; revenue: number }[];
  devices: { device: string; percentage: number }[];
  osBreakdown: { os: string; percentage: number }[];
  countries: { country: string; users: number }[];
}

export interface GTMEventMap {
  pillcareEvent: string;
  ga4Event: string;
  gtmTrigger: string;
  isConversion: boolean;
  marketingDestination: string;
}

export interface GTMContainerConfig {
  containerId: string;
  status: 'Draft' | 'Review' | 'Approved' | 'Published';
  publishedVersion: number;
  draftVersion: number;
  tagsCount: number;
  triggersCount: number;
  variablesCount: number;
  lastPublishedBy: string;
  lastPublishedAt: string;
  eventMappings: GTMEventMap[];
}

export interface FinancialSummary {
  grossRevenue: number;
  netRevenue: number;
  mrr: number;
  arr: number;
  dailyRevenue: { date: string; gross: number; net: number }[];
  revenueByPlan: { plan: string; revenue: number; count: number }[];
  revenueByCountry: { country: string; revenue: number }[];
  subscriptions: {
    active: number;
    newThisMonth: number;
    renewals: number;
    cancellations: number;
    failedRenewals: number;
    trialUsers: number;
    trialConversionRate: number;
    churnRate: number;
  };
  payments: {
    successful: number;
    failed: number;
    pending: number;
    refunds: number;
    chargebacks: number;
    gatewayFees: number;
    taxesGST: number;
    netSettlement: number;
  };
  unitEconomics: {
    cac: number;
    ltv: number;
    ltvCacRatio: number;
    arpu: number;
    grossMarginPercent: number;
    contributionMarginPercent: number;
    marketingSpend: number;
    costPerAcquisition: number;
  };
}

export interface PillCareUserRecord {
  id: string;
  name: string;
  email: string;
  plan: 'Free' | 'Basic' | 'Premium' | 'Enterprise';
  status: 'active' | 'inactive' | 'suspended';
  registeredAt: string;
  lastActive: string;
  device: string;
  appVersion: string;
  pushToken?: string;
  city?: string;
  state?: string;
  remindersCount: number;
  adherenceScore: number; // percentage
  ltvValueINR: number;
  caregiverPhone?: string;
  overrides?: Record<string, boolean>;
}

export interface FeatureFlagRecord {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  countries: string[];
  platforms: ('android' | 'ios')[];
  minAppVersion?: string;
  isBetaOnly: boolean;
  requiresConfirmation: boolean;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

export interface MedicationRecord {
  id: string;
  brandName: string;
  genericName: string;
  searchFrequency: number;
  lookupSuccessCount: number;
  openfdaMatched: boolean;
  aiFallbackUsed: boolean;
  manualOverride: boolean;
  lastUpdated: string;
  errorLogsCount: number;
}

export interface GroqTelemetry {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  tokensPrompt: number;
  tokensCompletion: number;
  estimatedCostUSD: number;
  activeModel: string;
  dailyUsage: { date: string; requests: number; costUSD: number }[];
  errorRatePercent: number;
}

export interface GroqPromptVersion {
  id: string;
  key: string;
  title: string;
  version: number;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  status: 'Draft' | 'Testing' | 'Published' | 'Archived';
  author: string;
  updatedAt: string;
}

export interface NotificationCampaign {
  id: string;
  title: string;
  body: string;
  channels: ('push' | 'email' | 'sms')[];
  targetAudience: 'all' | 'free_users' | 'premium_users' | 'inactive_7d' | 'custom';
  scheduledAt?: string;
  sentAt?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  sentCount: number;
  openRatePercent: number;
  clickRatePercent: number;
  createdBy: string;
}

export interface CMSContentRecord {
  id: string;
  title: string;
  type: 'article' | 'yoga' | 'faq' | 'announcement' | 'terms' | 'privacy';
  status: 'Draft' | 'InReview' | 'Published' | 'Unpublished';
  version: number;
  author: string;
  targetPlan?: string;
  updatedAt: string;
  content: string;
}

export interface InfrastructureItem {
  serviceKey: string;
  name: string;
  category: 'auth' | 'database' | 'ai' | 'cdn' | 'payment' | 'notification' | 'external_api';
  status: 'operational' | 'degraded' | 'outage';
  latencyMs: number;
  uptime99: number;
  rateLimitPercent: number;
  estimatedMonthlyCostUSD: number;
  lastSuccessfulCheck: string;
  lastFailureAt?: string;
  failureMessage?: string;
}

export interface SecurityEvent {
  id: string;
  eventType: 'admin_login' | 'failed_login' | 'suspicious_ip' | 'permission_change' | 'data_export' | 'account_deletion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  adminEmail: string;
  ipAddress: string;
  device: string;
  timestamp: string;
  details: string;
}

export interface AuditLogRecord {
  id: string;
  adminEmail: string;
  adminRole: AdminRole;
  action: string;
  timestamp: string;
  ipAddress: string;
  deviceSession: string;
  objectAffected: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  approvalStatus: 'APPROVED' | 'AUTO' | 'PENDING' | 'REJECTED';
}

export interface SystemReport {
  id: string;
  title: string;
  category: 'users' | 'revenue' | 'medication' | 'ai' | 'security' | 'compliance';
  format: 'CSV' | 'PDF' | 'JSON';
  generatedAt: string;
  generatedBy: string;
  sizeBytes: number;
  downloadUrl: string;
}
