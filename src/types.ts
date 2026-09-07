export type EntityType = 'person' | 'phone' | 'vehicle' | 'location' | 'org';
export type RelationshipType = 'call' | 'meeting' | 'transaction' | 'associate' | 'co-accused' | 'ownership';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  attributes: Record<string, string>;
  riskScore: number;
}

export interface Relationship {
  source: string;
  target: string;
  type: RelationshipType;
  timestamps: string[];
  count: number;
  linkedCrimeEventId?: string;
}

export interface CrimeEvent {
  id: string;
  firNumber: string;
  date: string;
  location: string;
  involvedEntityIds: string[];
}

export interface CentralityScore {
  entityId: string;
  degree: number;
  betweenness: number;
  eigenvector: number;
  pageRank: number;
}

export interface Community {
  id: number;
  members: string[];
}

export interface Anomaly {
  id: string;
  type: 'new_contact_before_crime' | 'burner_phone' | 'bridge_node' | 'unusual_pattern';
  severity: 'high' | 'medium' | 'low';
  description: string;
  entityIds: string[];
  crimeEventId?: string;
}

export type DetailKind =
  | 'phone'
  | 'call_records'
  | 'address'
  | 'vehicle'
  | 'email'
  | 'social'
  | 'bank'
  | 'transaction_history'
  | 'alias'
  | 'employer';

export interface ReportDetail {
  id: string;
  kind: DetailKind;
  value: string;
  meta?: string;
  note?: string;
  tags?: string[];
  createdAt: string;
}

export type AuditLogAction =
  | 'create_report'
  | 'add_detail'
  | 'edit_detail'
  | 'remove_detail'
  | 'submit_report'
  | 'ai_scan'
  | 'login'
  | 'logoff'
  | 'export'
  | 'access_denied'
  | 'tamper_detected'
  | 'create_officer'
  | 'update_officer'
  | 'delete_officer'
  | 'ocr_fir'
  | 'save_fir'
  | 'upload_attachment';

export type AuditLogLevel = 'info' | 'warn' | 'critical';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: AuditLogAction;
  level: AuditLogLevel;
  summary: string;
  target?: string;
}

export interface SubmittedReport {
  id: string;
  firNumber: string;
  incidentLocation?: string;
  subjectName: string;
  detailCount: number;
  details?: ReportDetail[];
  submittedAt: string;
  submittedBy: string;
}

export interface Officer {
  id: string;
  name: string;
  badgeNumber: string;
  rank: string;
  district: string;
  state: string;
  email: string;
  phone: string;
  role: 'case-officer' | 'analyst' | 'admin';
  createdAt: string;
  updatedAt?: string;
}

export interface FirAttachment {
  id: string;
  kind: 'call_records' | 'transaction_history' | 'other';
  name: string;
  size: string;
  checksum?: string;
  storagePath?: string;
  note?: string;
  createdAt: string;
}

export interface FirDocument {
  id: string;
  ref: string;
  firNumber: string;
  policeStation: string;
  district: string;
  state: string;
  incidentDate: string;
  incidentTime: string;
  sectionsLaw: string;
  complainantName: string;
  complainantAge: string;
  complainantFather: string;
  complainantAddress: string;
  complainantPhone: string;
  subjectName: string;
  subjectAliases: string;
  accusedDetails: string;
  incidentLocation: string;
  incidentDescription: string;
  evidenceSummary: string;
  ioName: string;
  ioRank: string;
  reportRef?: string;
  ocrSource?: string;
  attachments: FirAttachment[];
  createdAt: string;
  createdBy: string;
}
