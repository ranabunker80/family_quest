export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    email: string | null
                    full_name: string | null
                    avatar_url: string | null
                    role: "parent" | "kid"
                    coins: number
                    created_at: string
                }
                Insert: {
                    id: string
                    email?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    role?: "parent" | "kid"
                    coins?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    email?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    role?: "parent" | "kid"
                    coins?: number
                    created_at?: string
                }
            }
            missions: {
                Row: {
                    id: string
                    title: string
                    description: string | null
                    reward_amount: number
                    icon: string | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    description?: string | null
                    reward_amount: number
                    icon?: string | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    description?: string | null
                    reward_amount?: number
                    icon?: string | null
                    is_active?: boolean
                    created_at?: string
                }
            }
            rewards: {
                Row: {
                    id: string
                    title: string
                    cost: number
                    icon: string | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    cost: number
                    icon?: string | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    cost?: number
                    icon?: string | null
                    is_active?: boolean
                    created_at?: string
                }
            }
            ledger: {
                Row: {
                    id: string
                    kid_id: string
                    amount: number
                    description: string
                    type: "mission" | "reward" | "bonus" | "penalty"
                    status: "pending" | "approved" | "rejected"
                    created_at: string
                }
                Insert: {
                    id?: string
                    kid_id: string
                    amount: number
                    description: string
                    type: "mission" | "reward" | "bonus" | "penalty"
                    status?: "pending" | "approved" | "rejected"
                    created_at?: string
                }
                Update: {
                    id?: string
                    kid_id?: string
                    amount?: number
                    description?: string
                    type?: "mission" | "reward" | "bonus" | "penalty"
                    status?: "pending" | "approved" | "rejected"
                    created_at?: string
                }
            }
            family_members: {
                Row: {
                    id: string
                    parent_id: string
                    kid_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    parent_id: string
                    kid_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    parent_id?: string
                    kid_id?: string
                    created_at?: string
                }
            }
            parent_notes: {
                Row: {
                    id: string
                    author_id: string
                    kid_id: string | null
                    content: string
                    is_pinned: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    author_id: string
                    kid_id?: string | null
                    content: string
                    is_pinned?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    author_id?: string
                    kid_id?: string | null
                    content?: string
                    is_pinned?: boolean
                    created_at?: string
                }
            }
            educational_content: {
                Row: {
                    id: string
                    uploaded_by: string
                    title: string
                    content_type: "word_list" | "pdf" | "image" | "manual"
                    subject: string | null
                    target_kid_id: string | null
                    data: Json
                    file_url: string | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    uploaded_by: string
                    title: string
                    content_type: "word_list" | "pdf" | "image" | "manual"
                    subject?: string | null
                    target_kid_id?: string | null
                    data: Json
                    file_url?: string | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    uploaded_by?: string
                    title?: string
                    content_type?: "word_list" | "pdf" | "image" | "manual"
                    subject?: string | null
                    target_kid_id?: string | null
                    data?: Json
                    file_url?: string | null
                    is_active?: boolean
                    created_at?: string
                }
            }
            focus_areas: {
                Row: {
                    id: string
                    set_by: string
                    kid_id: string
                    category: string
                    priority: number
                    week_start: string
                    week_end: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    set_by: string
                    kid_id: string
                    category: string
                    priority?: number
                    week_start: string
                    week_end: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    set_by?: string
                    kid_id?: string
                    category?: string
                    priority?: number
                    week_start?: string
                    week_end?: string
                    created_at?: string
                }
            }
            game_results: {
                Row: {
                    id: string
                    kid_id: string
                    game_type: string
                    difficulty: string
                    score: number
                    accuracy: number
                    words_correct: number | null
                    words_total: number | null
                    time_seconds: number | null
                    details: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    kid_id: string
                    game_type: string
                    difficulty: string
                    score: number
                    accuracy: number
                    words_correct?: number | null
                    words_total?: number | null
                    time_seconds?: number | null
                    details?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    kid_id?: string
                    game_type?: string
                    difficulty?: string
                    score?: number
                    accuracy?: number
                    words_correct?: number | null
                    words_total?: number | null
                    time_seconds?: number | null
                    details?: Json | null
                    created_at?: string
                }
            }
        }
    }
}
