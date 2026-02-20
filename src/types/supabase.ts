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
        }
    }
}
