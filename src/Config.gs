/**
 * Course Tracker — Config & Schema (v0.2.0, Stage 1 foundation)
 * Pure declarations only. No cross-file evaluation at load time (Apps Script load order is not guaranteed).
 */

const APP = {
  VERSION: '1.0.6-b7b8-r3-product-dev6.2-uxqa1',
  SCHEMA_VERSION: 3,
  TZ: 'Asia/Jerusalem',
  PROP: {
    MAIN_DB: 'MAIN_SPREADSHEET_ID',
    PRIVATE_DB: 'PRIVATE_SPREADSHEET_ID',
    ADMIN_EMAIL: 'ADMIN_EMAIL'
  },
  // Technical limits (not business values)
  MAX_JSON_CELL: 45000,
  NAV_DISTANCE_STEP_KM: 0.5,
  NAV_DISTANCE_MAX_KM: 100,           // technical sanity ceiling, adjustable
  PERSONAL_NUMBER_PATTERN: /^[0-9]{1,12}$/, // ASSUMPTION: digits only, stored as text (leading zeros preserved)
  PREVIEW_TTL_SECONDS: 1800
};

const ROLES = { ADMIN: 'admin', COMMANDER: 'commander' };
const RECORD_STATUS = { ACTIVE: 'active', CANCELLED: 'cancelled' };
const COURSE_STATUS = { ACTIVE: 'active', ARCHIVED: 'archived' };
const GENDERS = ['M', 'F'];
const GENDER_LABELS = { M: 'זכר', F: 'נקבה' };

// Default (temporary, configurable) names — real names were not provided.
const DEFAULT_ORG = [
  { name: 'מחלקה א׳ (זמני)', teams: ['צוות 1 (זמני)', 'צוות 2 (זמני)'] },
  { name: 'מחלקה ב׳ (זמני)', teams: ['צוות 3 (זמני)', 'צוות 4 (זמני)'] }
];

const C_RESULT = ['record_status', 'version', 'request_id', 'updated_at', 'updated_by', 'cancelled_at', 'cancelled_by', 'cancel_reason'];

/**
 * TABLES: name -> { store: 'main'|'private', cols: [...], textCols: [...] (forced plain-text), kind }
 * Every table has `id`. Results are append-only (cancel/restore/correct, never delete).
 */
const TABLES = {
  SchemaMeta: { store: 'main', kind: 'meta', cols: ['id', 'value', 'updated_at'] },
  Courses: { store: 'main', kind: 'entity', cols: ['id', 'name', 'start_date', 'status', 'created_at', 'created_by', 'archived_at', 'archived_by', 'reopened_at', 'reopened_by', 'cloned_from'], textCols: ['start_date'] },
  Departments: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'name', 'sort_order', 'active', 'created_at', 'created_by'] },
  Teams: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'department_id', 'name', 'sort_order', 'active', 'created_at', 'created_by'] },
  Users: { store: 'main', kind: 'entity', cols: ['id', 'email', 'display_name', 'role', 'course_scope', 'active', 'created_at', 'created_by', 'updated_at', 'updated_by'] },
  Soldiers: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'personal_number', 'full_name', 'gender', 'department_id', 'team_id', 'pakal', 'enlistment_date', 'sociometric_third', 'pzm_value', 'pzm_flag', 'commander_note', 'active', 'record_status', 'created_at', 'created_by', 'updated_at', 'updated_by'], textCols: ['personal_number', 'enlistment_date', 'pakal'] },
  CommanderAssignments: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'user_email', 'scope_type', 'scope_id', 'active', 'created_at', 'created_by', 'updated_at', 'updated_by'] },
  Favorites: { store: 'private', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'user_email', 'created_at'] },

  FitnessTestTypes: { store: 'main', kind: 'config', cols: ['id', 'course_id', 'name', 'components_json', 'weights_json', 'active', 'created_at', 'created_by', 'variants_json', 'is_opening'] },
  FitnessScoringVersions: { store: 'main', kind: 'config', cols: ['id', 'course_id', 'label', 'status', 'approved_by', 'approved_at', 'source_note', 'created_at', 'created_by', 'gender_map_json', 'issues_json'] },
  FitnessScoringRows: { store: 'main', kind: 'config', cols: ['id', 'version_id', 'gender', 'component', 'variant', 'score', 'from_value', 'to_value', 'created_at', 'kind', 'sheet', 'row_no', 'flag'] },
  FitnessTests: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'soldier_id', 'test_date', 'test_type_id', 'raw_values_json', 'component_scores_json', 'weighted_score', 'scoring_version_id', 'notes', 'created_at', 'created_by'].concat(C_RESULT), textCols: ['test_date'] },
  MarksmanshipTests: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'soldier_id', 'test_date', 'weapon_type', 'distance_m', 'examiner_score', 'weapon_zeroed', 'ylm_score', 'notes', 'created_at', 'created_by', 'test_kind'].concat(C_RESULT), textCols: ['test_date'] },
  NavigationTypes: { store: 'main', kind: 'config', cols: ['id', 'course_id', 'name', 'active', 'created_at', 'created_by'] },
  NavigationTests: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'soldier_id', 'test_date', 'navigation_type_id', 'distance_km', 'plan_score', 'debrief_score', 'points_completed', 'points_total', 'points_score', 'final_score', 'formula_version', 'notes', 'created_at', 'created_by'].concat(C_RESULT).concat(['event_id']), textCols: ['test_date'] },
  NavigationEvents: { store: 'main', kind: 'config', cols: ['id', 'course_id', 'navigation_type_id', 'test_date', 'label', 'distance_km', 'points_total', 'notes', 'status', 'record_status', 'version', 'request_id', 'completed_at', 'completed_by', 'created_at', 'created_by', 'updated_at', 'updated_by'], textCols: ['test_date'] },
  ExamDefinitions: { store: 'main', kind: 'config', cols: ['id', 'course_id', 'name', 'exam_type', 'pass_score', 'created_at', 'created_by'] },
  TheoreticalExamAttempts: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'soldier_id', 'exam_id', 'attempt', 'attempt_date', 'score', 'created_at', 'created_by'].concat(C_RESULT), textCols: ['attempt_date'] },
  ExamMeetings: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'soldier_id', 'exam_id', 'required', 'owner_role', 'done', 'meeting_date', 'notes', 'created_at', 'created_by'].concat(C_RESULT), textCols: ['meeting_date'] },
  ActivityTypes: { store: 'main', kind: 'config', cols: ['id', 'course_id', 'name', 'active', 'created_at', 'created_by'] },
  AttendanceEvents: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'event_date', 'activity_type_id', 'scope_type', 'scope_id', 'description', 'created_at', 'created_by'].concat(C_RESULT), textCols: ['event_date'] },
  AttendanceRecords: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'event_id', 'soldier_id', 'present', 'early_exit', 'absence_approved', 'notes', 'created_at', 'created_by'].concat(C_RESULT) },
  Marches: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'march_date', 'location', 'km_no_stretcher', 'km_stretcher', 'total_km', 'created_at', 'created_by', 'scope_type', 'scope_id'].concat(C_RESULT), textCols: ['march_date'] },
  MarchAttendance: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'march_id', 'soldier_id', 'present', 'notes', 'created_at', 'created_by'].concat(C_RESULT) },
  Qualifications: { store: 'main', kind: 'config', cols: ['id', 'course_id', 'name', 'completion_terms', 'scope_type', 'target_date', 'early_alert_days', 'active', 'created_at', 'created_by'], textCols: ['target_date'] },
  QualificationAssignments: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'qualification_id', 'soldier_id', 'status', 'completion_date', 'score', 'notes', 'exclusion_status', 'created_at', 'created_by', 'exclusion_reason', 'exclusion_requested_by', 'exclusion_reviewed_by', 'status_history_json'].concat(C_RESULT), textCols: ['completion_date'] },
  QualificationEvidence: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'assignment_id', 'document_id', 'file_name', 'uploaded_by', 'uploaded_at'] },
  QualificationDueDateHistory: { store: 'main', kind: 'log', cols: ['id', 'course_id', 'qualification_id', 'original_date', 'new_date', 'reason', 'changed_by', 'changed_at'] },
  ReadinessRecords: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'soldier_id', 'status', 'restrictions', 'start_date', 'next_review_date', 'created_at', 'created_by'].concat(C_RESULT), textCols: ['start_date', 'next_review_date'] },
  ReadinessReviews: { store: 'main', kind: 'log', cols: ['id', 'course_id', 'soldier_id', 'review_date', 'decision', 'changed_restrictions', 'next_review_date', 'created_at', 'created_by'], textCols: ['review_date', 'next_review_date'] },
  Documents: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'document_type', 'drive_file_id', 'file_name', 'uploaded_by', 'uploaded_at', 'approval_status', 'linked_record_id', 'linked_table', 'mime_type', 'size_bytes', 'link_requested_by', 'link_reviewed_by'] },
  SharedResultNotes: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'table_name', 'record_id', 'author_email', 'text', 'mentions', 'record_status', 'created_at', 'cancelled_by', 'cancelled_at'] },
  SoldierEvents: { store: 'main', kind: 'result', cols: ['id', 'course_id', 'soldier_id', 'event_date', 'event_type', 'description', 'created_at', 'created_by'].concat(C_RESULT), textCols: ['event_date'] },
  Alerts: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'topic', 'rule_key', 'reason', 'urgency', 'status', 'opened_at', 'handled_by', 'handled_at', 'dedupe_key', 'ref_id', 'due_date'], textCols: ['due_date'] },
  AssistantDrafts: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'kind', 'content', 'basis_json', 'status', 'created_by', 'created_at', 'reviewed_by', 'reviewed_at', 'review_note'] },
  CorrectionRequests: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'table_name', 'record_id', 'changes_json', 'reason', 'requested_by', 'requested_at', 'status', 'reviewed_by', 'reviewed_at', 'review_note', 'before_json'] },
  AuditLog: { store: 'main', kind: 'log', cols: ['id', 'course_id', 'actor_email', 'action', 'table_name', 'record_id', 'before_json', 'after_json', 'reason', 'timestamp'] },
  ThresholdSettings: { store: 'main', kind: 'config', cols: ['id', 'course_id', 'domain', 'setting_key', 'setting_value', 'effective_from', 'updated_by', 'updated_at', 'reason'], textCols: ['effective_from'] },
  OCRJobs: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'document_id', 'target', 'uploaded_by', 'uploaded_at', 'status', 'reviewed_by', 'reviewed_at', 'provider'] },
  OCRExtractedRows: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'job_id', 'soldier_id', 'candidates_json', 'extraction_json', 'uncertain_fields', 'status', 'reviewed_by', 'reviewed_at', 'committed_record_id', 'review_note'] },
  ReportJobs: { store: 'main', kind: 'log', cols: ['id', 'course_id', 'requested_by', 'requested_at', 'params_json', 'format', 'file_id', 'rows_count', 'include_private'] },
  BackupJobs: { store: 'main', kind: 'log', cols: ['id', 'kind', 'requested_by', 'started_at', 'finished_at', 'status', 'file_id', 'note', 'tables_count', 'rows_count', 'checksum', 'app_version'] },
  AlertHistory: { store: 'main', kind: 'log', cols: ['id', 'course_id', 'alert_id', 'from_status', 'to_status', 'changed_by', 'changed_at', 'note'] },
  SoldierUpdateRequests: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'personal_number', 'request_kind', 'payload_json', 'status', 'requested_at', 'reviewed_by', 'reviewed_at', 'review_note', 'token_id'] },
  FormTokens: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'token_hash', 'expires_at', 'used_at', 'created_by', 'created_at'] },
  ImportJobs: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'target', 'file_name', 'mapping_json', 'status', 'created_by', 'created_at', 'reviewed_by', 'reviewed_at', 'summary_json'] },
  ImportRows: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'job_id', 'row_no', 'data_json', 'issues_json', 'status', 'committed_record_id'] },

  // ---- private store: separate spreadsheet, never returned by general list endpoints ----
  SoldierPersonalDetails: { store: 'private', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'field_key', 'field_value', 'sensitivity_class', 'updated_at', 'updated_by'] },
  CommanderAssessments: { store: 'private', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'assessment_date', 'author_email', 'strengths', 'improvement_areas', 'domain', 'corrects_id', 'created_at'], textCols: ['assessment_date'] },
  PrivateNotes: { store: 'private', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'note_group_id', 'revision', 'note_text', 'created_at', 'created_by'] },
  // product-dev6: meeting minutes + linked tasks (commander/admin only). rev/committed_rev implement the staged-write commit (a row is visible only when rev <= meeting.committed_rev).
  MeetingMinutes: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'subject', 'meeting_at', 'participants', 'summary', 'decisions', 'request_id', 'committed_rev', 'version', 'created_at', 'created_by', 'updated_at', 'updated_by'], textCols: ['meeting_at'] },
  MeetingTasks: { store: 'main', kind: 'entity', cols: ['id', 'course_id', 'meeting_id', 'client_key', 'seq', 'title', 'assignee_email', 'due_date', 'due_time', 'priority', 'notes', 'status', 'rev', 'row_state', 'version', 'created_at', 'created_by', 'updated_at', 'updated_by', 'completed_at', 'completed_by', 'cancelled_at', 'cancelled_by'], textCols: ['due_date', 'due_time'] },
  MeetingTaskEvents: { store: 'main', kind: 'log', cols: ['id', 'course_id', 'meeting_id', 'task_id', 'rev', 'row_state', 'actor_email', 'action', 'field', 'old_value', 'new_value', 'note', 'timestamp'] },
  PersonalFollowUps: { store: 'private', kind: 'entity', cols: ['id', 'course_id', 'soldier_id', 'what_to_check', 'due_date', 'private_note', 'status', 'created_at', 'created_by', 'updated_at'], textCols: ['due_date'] },
  FollowUpHistory: { store: 'private', kind: 'log', cols: ['id', 'followup_id', 'from_status', 'to_status', 'old_due', 'new_due', 'changed_by', 'changed_at'] }
};

/** Tables that clone with a new course (structure/config only; never people/results/history). */
const CLONEABLE = ['Departments', 'Teams', 'ThresholdSettings', 'ActivityTypes', 'NavigationTypes', 'FitnessTestTypes', 'ExamDefinitions', 'Qualifications'];   // v1.0.0: + Qualifications (definitions only, never assignments)

/** Tables whose content must never be copied into AuditLog payloads or generic exports. */
const PRIVATE_TABLES = Object.keys(TABLES).filter(function (t) { return TABLES[t].store === 'private'; });
