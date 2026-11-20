
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "daily_study_plan_tasks": {
                  Row: {
                    "assignment_source": string,"completed_at": string | null,"completed_review_event_id": string | null,"completion_event_id_snapshot": string | null,"created_at": string,"deferred_at": string | null,"difficulty": string,"id": string,"kind": string,"leetcode_frontend_id": string | null,"leetcode_slug": string,"leetcode_url": string,"mastery_score_snapshot": number | null,"next_review_at_snapshot": string | null,"origin": string,"original_user_problem_id": string | null,"plan_id": string,"position": number,"review_pool_snapshot": string | null,"roadmap_order": number | null,"schedule_version_snapshot": number | null,"status": string,"title": string,"unassigned_at": string | null,"unassignment_reason": string | null,"user_id": string,"user_problem_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_source"?: string,"completed_at"?: string | null,"completed_review_event_id"?: string | null,"completion_event_id_snapshot"?: string | null,"created_at"?: string,"deferred_at"?: string | null,"difficulty": string,"id"?: string,"kind": string,"leetcode_frontend_id"?: string | null,"leetcode_slug": string,"leetcode_url": string,"mastery_score_snapshot"?: number | null,"next_review_at_snapshot"?: string | null,"origin": string,"original_user_problem_id"?: string | null,"plan_id": string,"position": number,"review_pool_snapshot"?: string | null,"roadmap_order"?: number | null,"schedule_version_snapshot"?: number | null,"status"?: string,"title": string,"unassigned_at"?: string | null,"unassignment_reason"?: string | null,"user_id": string,"user_problem_id"?: string | null
                  }
                  Update: {
                    "assignment_source"?: string,"completed_at"?: string | null,"completed_review_event_id"?: string | null,"completion_event_id_snapshot"?: string | null,"created_at"?: string,"deferred_at"?: string | null,"difficulty"?: string,"id"?: string,"kind"?: string,"leetcode_frontend_id"?: string | null,"leetcode_slug"?: string,"leetcode_url"?: string,"mastery_score_snapshot"?: number | null,"next_review_at_snapshot"?: string | null,"origin"?: string,"original_user_problem_id"?: string | null,"plan_id"?: string,"position"?: number,"review_pool_snapshot"?: string | null,"roadmap_order"?: number | null,"schedule_version_snapshot"?: number | null,"status"?: string,"title"?: string,"unassigned_at"?: string | null,"unassignment_reason"?: string | null,"user_id"?: string,"user_problem_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_study_plan_tasks_completed_review_event_id_fkey"
      columns: ["completed_review_event_id"]
isOneToOne: true
      referencedRelation: "review_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_study_plan_tasks_plan_id_user_id_fkey"
      columns: ["plan_id","user_id"]
isOneToOne: false
      referencedRelation: "daily_study_plans"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "daily_study_plan_tasks_user_problem_id_user_id_fkey"
      columns: ["user_problem_id","user_id"]
isOneToOne: false
      referencedRelation: "user_problems"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"daily_study_plans": {
                  Row: {
                    "created_at": string,"day_ends_at": string,"day_starts_at": string,"followed_roadmap_id_snapshot": string | null,"id": string,"new_problem_shortage_count": number,"new_problem_target": number,"new_selection_mode_snapshot": string,"planned_task_count": number,"reference_time": string,"review_roadmap_ids_snapshot": (string)[],"review_shortage_count": number,"review_source_snapshot": string,"review_target": number,"roadmap_id": string,"selection_version": string,"settings_revision_id": string | null,"settings_version_snapshot": number | null,"shuffle_seed": string | null,"study_date": string,"time_zone": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_ends_at": string,"day_starts_at": string,"followed_roadmap_id_snapshot"?: string | null,"id"?: string,"new_problem_shortage_count"?: number,"new_problem_target"?: number,"new_selection_mode_snapshot"?: string,"planned_task_count": number,"reference_time": string,"review_roadmap_ids_snapshot"?: (string)[],"review_shortage_count"?: number,"review_source_snapshot"?: string,"review_target"?: number,"roadmap_id": string,"selection_version"?: string,"settings_revision_id"?: string | null,"settings_version_snapshot"?: number | null,"shuffle_seed"?: string | null,"study_date": string,"time_zone": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"day_ends_at"?: string,"day_starts_at"?: string,"followed_roadmap_id_snapshot"?: string | null,"id"?: string,"new_problem_shortage_count"?: number,"new_problem_target"?: number,"new_selection_mode_snapshot"?: string,"planned_task_count"?: number,"reference_time"?: string,"review_roadmap_ids_snapshot"?: (string)[],"review_shortage_count"?: number,"review_source_snapshot"?: string,"review_target"?: number,"roadmap_id"?: string,"selection_version"?: string,"settings_revision_id"?: string | null,"settings_version_snapshot"?: number | null,"shuffle_seed"?: string | null,"study_date"?: string,"time_zone"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_study_plans_followed_roadmap_snapshot_fkey"
      columns: ["followed_roadmap_id_snapshot"]
isOneToOne: false
      referencedRelation: "study_roadmaps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_study_plans_roadmap_id_fkey"
      columns: ["roadmap_id"]
isOneToOne: false
      referencedRelation: "study_roadmaps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_study_plans_settings_revision_fkey"
      columns: ["settings_revision_id","user_id"]
isOneToOne: false
      referencedRelation: "study_plan_setting_revisions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"review_allocation_context_roadmaps": {
                  Row: {
                    "context_id": string,"roadmap_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context_id": string,"roadmap_id": string,"user_id": string
                  }
                  Update: {
                    "context_id"?: string,"roadmap_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_allocation_context_roadmaps_context_id_user_id_fkey"
      columns: ["context_id","user_id"]
isOneToOne: false
      referencedRelation: "review_allocation_contexts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "review_allocation_context_roadmaps_roadmap_id_fkey"
      columns: ["roadmap_id"]
isOneToOne: false
      referencedRelation: "study_roadmaps"
      referencedColumns: ["id"]
    }
                  ]
                },"review_allocation_contexts": {
                  Row: {
                    "created_at": string,"filter_fingerprint": string,"id": string,"review_source": string,"scheduling_policy_version": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"filter_fingerprint": string,"id"?: string,"review_source": string,"scheduling_policy_version"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"filter_fingerprint"?: string,"id"?: string,"review_source"?: string,"scheduling_policy_version"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"review_allocation_entries": {
                  Row: {
                    "active": boolean,"allocation_key": string,"candidate_problem_id_snapshot": string,"candidate_user_problem_id": string | null,"context_id": string,"created_at": string,"daily_study_plan_task_id": string | null,"daily_study_plan_task_id_snapshot": string | null,"established_weight": number,"id": string,"imported_weight": number,"pool": string,"reversal_reason": string | null,"reversed_at": string | null,"review_event_id": string | null,"review_event_id_snapshot": string | null,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"allocation_key": string,"candidate_problem_id_snapshot": string,"candidate_user_problem_id"?: string | null,"context_id": string,"created_at"?: string,"daily_study_plan_task_id"?: string | null,"daily_study_plan_task_id_snapshot"?: string | null,"established_weight": number,"id"?: string,"imported_weight": number,"pool": string,"reversal_reason"?: string | null,"reversed_at"?: string | null,"review_event_id"?: string | null,"review_event_id_snapshot"?: string | null,"source": string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"allocation_key"?: string,"candidate_problem_id_snapshot"?: string,"candidate_user_problem_id"?: string | null,"context_id"?: string,"created_at"?: string,"daily_study_plan_task_id"?: string | null,"daily_study_plan_task_id_snapshot"?: string | null,"established_weight"?: number,"id"?: string,"imported_weight"?: number,"pool"?: string,"reversal_reason"?: string | null,"reversed_at"?: string | null,"review_event_id"?: string | null,"review_event_id_snapshot"?: string | null,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_allocation_entries_candidate_user_problem_id_user_i_fkey"
      columns: ["candidate_user_problem_id","user_id"]
isOneToOne: false
      referencedRelation: "user_problems"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "review_allocation_entries_context_id_user_id_fkey"
      columns: ["context_id","user_id"]
isOneToOne: false
      referencedRelation: "review_allocation_contexts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "review_allocation_entries_daily_study_plan_task_id_user_id_fkey"
      columns: ["daily_study_plan_task_id","user_id"]
isOneToOne: false
      referencedRelation: "daily_study_plan_tasks"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "review_allocation_entries_review_event_id_user_id_fkey"
      columns: ["review_event_id","user_id"]
isOneToOne: false
      referencedRelation: "review_events"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"review_events": {
                  Row: {
                    "correctable_until": string,"corrected_at": string | null,"id": string,"new_review_stage": number,"next_review_at": string,"practice_local_date": string | null,"practice_time_zone": string | null,"pre_practice_problem_type": string | null,"pre_practice_review_pool": string | null,"previous_consecutive_good_count": number,"previous_mastery_score": number,"previous_next_review_at": string | null,"previous_review_stage": number,"previous_total_reviews": number,"rating": string,"resulting_consecutive_good_count": number,"resulting_schedule_version": number,"reviewed_at": string,"scheduling_policy_version": string,"transition_kind": string,"transition_time_zone": string | null,"user_id": string,"user_problem_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correctable_until": string,"corrected_at"?: string | null,"id"?: string,"new_review_stage": number,"next_review_at": string,"practice_local_date"?: string | null,"practice_time_zone"?: string | null,"pre_practice_problem_type"?: string | null,"pre_practice_review_pool"?: string | null,"previous_consecutive_good_count"?: number,"previous_mastery_score": number,"previous_next_review_at"?: string | null,"previous_review_stage": number,"previous_total_reviews": number,"rating": string,"resulting_consecutive_good_count"?: number,"resulting_schedule_version": number,"reviewed_at"?: string,"scheduling_policy_version"?: string,"transition_kind": string,"transition_time_zone"?: string | null,"user_id": string,"user_problem_id": string
                  }
                  Update: {
                    "correctable_until"?: string,"corrected_at"?: string | null,"id"?: string,"new_review_stage"?: number,"next_review_at"?: string,"practice_local_date"?: string | null,"practice_time_zone"?: string | null,"pre_practice_problem_type"?: string | null,"pre_practice_review_pool"?: string | null,"previous_consecutive_good_count"?: number,"previous_mastery_score"?: number,"previous_next_review_at"?: string | null,"previous_review_stage"?: number,"previous_total_reviews"?: number,"rating"?: string,"resulting_consecutive_good_count"?: number,"resulting_schedule_version"?: number,"reviewed_at"?: string,"scheduling_policy_version"?: string,"transition_kind"?: string,"transition_time_zone"?: string | null,"user_id"?: string,"user_problem_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_events_user_problem_user_fk"
      columns: ["user_problem_id","user_id"]
isOneToOne: false
      referencedRelation: "user_problems"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"study_plan_setting_revisions": {
                  Row: {
                    "created_at": string,"daily_new_target": number,"daily_review_target": number,"effective_study_date": string,"followed_roadmap_id": string | null,"id": string,"new_selection_mode": string,"review_allocation_context_id": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"daily_new_target": number,"daily_review_target": number,"effective_study_date": string,"followed_roadmap_id"?: string | null,"id"?: string,"new_selection_mode": string,"review_allocation_context_id": string,"user_id": string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"daily_new_target"?: number,"daily_review_target"?: number,"effective_study_date"?: string,"followed_roadmap_id"?: string | null,"id"?: string,"new_selection_mode"?: string,"review_allocation_context_id"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_plan_setting_revisions_followed_roadmap_id_fkey"
      columns: ["followed_roadmap_id"]
isOneToOne: false
      referencedRelation: "study_roadmaps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_plan_setting_revisions_review_allocation_context_id__fkey"
      columns: ["review_allocation_context_id","user_id"]
isOneToOne: false
      referencedRelation: "review_allocation_contexts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"study_roadmap_problems": {
                  Row: {
                    "leetcode_slug": string,"position": number,"roadmap_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "leetcode_slug": string,"position": number,"roadmap_id": string
                  }
                  Update: {
                    "leetcode_slug"?: string,"position"?: number,"roadmap_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_roadmap_problems_roadmap_id_fkey"
      columns: ["roadmap_id"]
isOneToOne: false
      referencedRelation: "study_roadmaps"
      referencedColumns: ["id"]
    }
                  ]
                },"study_roadmaps": {
                  Row: {
                    "content_version": string,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_version": string,"created_at"?: string,"id": string,"name": string
                  }
                  Update: {
                    "content_version"?: string,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_problems": {
                  Row: {
                    "consecutive_good_count": number,"created_at": string,"difficulty": string,"external_activity_date": string | null,"external_practice_status": string | null,"id": string,"last_reviewed_at": string | null,"leetcode_frontend_id": string | null,"leetcode_slug": string,"leetcode_topics": (string)[],"leetcode_url": string,"lifecycle_state": string,"mastery_score": number,"next_review_at": string,"notes": string,"provisional_mastery_score": number | null,"review_stage": number,"schedule_version": number,"scheduling_policy_version": string,"source": string,"title": string,"total_reviews": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consecutive_good_count"?: number,"created_at"?: string,"difficulty": string,"external_activity_date"?: string | null,"external_practice_status"?: string | null,"id"?: string,"last_reviewed_at"?: string | null,"leetcode_frontend_id"?: string | null,"leetcode_slug": string,"leetcode_topics"?: (string)[],"leetcode_url": string,"lifecycle_state"?: string,"mastery_score"?: number,"next_review_at"?: string,"notes"?: string,"provisional_mastery_score"?: never,"review_stage"?: number,"schedule_version"?: number,"scheduling_policy_version"?: string,"source"?: string,"title": string,"total_reviews"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "consecutive_good_count"?: number,"created_at"?: string,"difficulty"?: string,"external_activity_date"?: string | null,"external_practice_status"?: string | null,"id"?: string,"last_reviewed_at"?: string | null,"leetcode_frontend_id"?: string | null,"leetcode_slug"?: string,"leetcode_topics"?: (string)[],"leetcode_url"?: string,"lifecycle_state"?: string,"mastery_score"?: number,"next_review_at"?: string,"notes"?: string,"provisional_mastery_score"?: never,"review_stage"?: number,"schedule_version"?: number,"scheduling_policy_version"?: string,"source"?: string,"title"?: string,"total_reviews"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_study_preferences": {
                  Row: {
                    "created_at": string,"time_zone": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"time_zone": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"time_zone"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_problem_to_today":
{ Args: { "p_difficulty": string,"p_expected_schedule_version"?: number,"p_intent": string,"p_leetcode_frontend_id": string,"p_leetcode_slug": string,"p_leetcode_topics": (string)[],"p_leetcode_url": string,"p_roadmap_order"?: number,"p_selection_source"?: string,"p_title": string }; Returns: {
              "correctable_until": string,"outcome": string,"review_event_id": string,"task_id": string,"task_status": string
            }[]
                           },
"correct_review_rating":
{ Args: { "p_rating": string,"p_review_event_id": string }; Returns: {
              "correctable_until": string,"new_next_review_at": string,"new_review_stage": number,"new_schedule_version": number,"rating": string,"review_event_id": string
            }[]
                           },
"create_daily_study_plan":
{ Args: { "p_reference_time": string,"p_tasks": Json,"p_time_zone": string }; Returns: {
              "created_at": string,
"day_ends_at": string,
"day_starts_at": string,
"followed_roadmap_id_snapshot": string | null,
"id": string,
"new_problem_shortage_count": number,
"new_problem_target": number,
"new_selection_mode_snapshot": string,
"planned_task_count": number,
"reference_time": string,
"review_roadmap_ids_snapshot": (string)[],
"review_shortage_count": number,
"review_source_snapshot": string,
"review_target": number,
"roadmap_id": string,
"selection_version": string,
"settings_revision_id": string | null,
"settings_version_snapshot": number | null,
"shuffle_seed": string | null,
"study_date": string,
"time_zone": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "daily_study_plans"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_user_problem_with_timezone":
{ Args: { "p_difficulty": string,"p_leetcode_frontend_id": string,"p_leetcode_slug": string,"p_leetcode_topics": (string)[],"p_leetcode_url": string,"p_notes": string,"p_rating": string,"p_start_date": string,"p_start_mode": string,"p_time_zone": string,"p_title": string }; Returns: {
              "correctable_until": string,"mastery_score": number,"next_review_at": string,"review_event_id": string,"review_stage": number,"total_reviews": number,"user_problem_id": string
            }[]
                           },
"create_v1_daily_study_plan":
{ Args: { "p_reference_time": string,"p_settings_revision_id": string,"p_tasks": Json,"p_time_zone": string }; Returns: {
              "created_at": string,
"day_ends_at": string,
"day_starts_at": string,
"followed_roadmap_id_snapshot": string | null,
"id": string,
"new_problem_shortage_count": number,
"new_problem_target": number,
"new_selection_mode_snapshot": string,
"planned_task_count": number,
"reference_time": string,
"review_roadmap_ids_snapshot": (string)[],
"review_shortage_count": number,
"review_source_snapshot": string,
"review_target": number,
"roadmap_id": string,
"selection_version": string,
"settings_revision_id": string | null,
"settings_version_snapshot": number | null,
"shuffle_seed": string | null,
"study_date": string,
"time_zone": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "daily_study_plans"
        isOneToOne: true
        isSetofReturn: false
      } },
"defer_daily_study_plan_task":
{ Args: { "p_task_id": string }; Returns: {
              "assignment_source": string,
"completed_at": string | null,
"completed_review_event_id": string | null,
"completion_event_id_snapshot": string | null,
"created_at": string,
"deferred_at": string | null,
"difficulty": string,
"id": string,
"kind": string,
"leetcode_frontend_id": string | null,
"leetcode_slug": string,
"leetcode_url": string,
"mastery_score_snapshot": number | null,
"next_review_at_snapshot": string | null,
"origin": string,
"original_user_problem_id": string | null,
"plan_id": string,
"position": number,
"review_pool_snapshot": string | null,
"roadmap_order": number | null,
"schedule_version_snapshot": number | null,
"status": string,
"title": string,
"unassigned_at": string | null,
"unassignment_reason": string | null,
"user_id": string,
"user_problem_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "daily_study_plan_tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_effective_study_plan_settings":
{ Args: { "p_reference_time"?: string }; Returns: {
              "daily_new_target": number,"daily_review_target": number,"effective_study_date": string,"followed_roadmap_id": string,"new_selection_mode": string,"review_allocation_context_id": string,"review_roadmap_ids": (string)[],"review_source": string,"revision_id": string,"time_zone": string,"version": number
            }[]
                           },
"import_leetcode_history":
{ Args: { "p_problems": Json }; Returns: {
              "already_tracked_count": number,"failed_count": number,"imported_count": number,"skipped_count": number
            }[]
                           },
"rate_new_daily_study_task":
{ Args: { "p_difficulty": string,"p_leetcode_frontend_id": string,"p_leetcode_slug": string,"p_leetcode_topics": (string)[],"p_leetcode_url": string,"p_rating": string,"p_task_id": string,"p_title": string }; Returns: {
              "assignment_source": string,
"completed_at": string | null,
"completed_review_event_id": string | null,
"completion_event_id_snapshot": string | null,
"created_at": string,
"deferred_at": string | null,
"difficulty": string,
"id": string,
"kind": string,
"leetcode_frontend_id": string | null,
"leetcode_slug": string,
"leetcode_url": string,
"mastery_score_snapshot": number | null,
"next_review_at_snapshot": string | null,
"origin": string,
"original_user_problem_id": string | null,
"plan_id": string,
"position": number,
"review_pool_snapshot": string | null,
"roadmap_order": number | null,
"schedule_version_snapshot": number | null,
"status": string,
"title": string,
"unassigned_at": string | null,
"unassignment_reason": string | null,
"user_id": string,
"user_problem_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "daily_study_plan_tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_and_reconcile_study_plan_settings":
{ Args: { "p_apply_when": string,"p_daily_new_target": number,"p_daily_review_target": number,"p_followed_roadmap_id": string,"p_new_selection_mode": string,"p_reference_time": string,"p_review_roadmap_ids": (string)[],"p_review_source": string,"p_tasks": Json,"p_time_zone": string }; Returns: {
              "created_at": string,
"daily_new_target": number,
"daily_review_target": number,
"effective_study_date": string,
"followed_roadmap_id": string | null,
"id": string,
"new_selection_mode": string,
"review_allocation_context_id": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "study_plan_setting_revisions"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_study_plan_settings":
{ Args: { "p_apply_when": string,"p_daily_new_target": number,"p_daily_review_target": number,"p_followed_roadmap_id": string,"p_new_selection_mode": string,"p_review_roadmap_ids": (string)[],"p_review_source": string,"p_time_zone": string }; Returns: {
              "created_at": string,
"daily_new_target": number,
"daily_review_target": number,
"effective_study_date": string,
"followed_roadmap_id": string | null,
"id": string,
"new_selection_mode": string,
"review_allocation_context_id": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "study_plan_setting_revisions"
        isOneToOne: true
        isSetofReturn: false
      } },
"snooze_problem_review":
{ Args: { "p_expected_schedule_version": number,"p_time_zone": string,"p_user_problem_id": string }; Returns: undefined
                           },
"submit_problem_review":
{ Args: { "p_expected_schedule_version": number,"p_rating": string,"p_user_problem_id": string }; Returns: {
              "correctable_until": string,"new_next_review_at": string,"new_review_stage": number,"new_schedule_version": number,"review_event_id": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
