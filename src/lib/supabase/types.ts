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
      users: {
        Row: {
          id: string
          email: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      books: {
        Row: {
          id: string
          title: string
          author: string | null
          isbn: string | null
          cover_url: string | null
          description: string | null
          page_count: number | null
          published_date: string | null
          ol_key: string | null
          google_books_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          author?: string | null
          isbn?: string | null
          cover_url?: string | null
          description?: string | null
          page_count?: number | null
          published_date?: string | null
          ol_key?: string | null
          google_books_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          author?: string | null
          isbn?: string | null
          cover_url?: string | null
          description?: string | null
          page_count?: number | null
          published_date?: string | null
          ol_key?: string | null
          google_books_id?: string | null
          created_at?: string
        }
      }
      user_books: {
        Row: {
          id: string
          user_id: string
          book_id: string
          status: 'want_to_read' | 'reading' | 'read' | 'dnf'
          current_page: number | null
          started_at: string | null
          finished_at: string | null
          rating: number | null
          review: string | null
          notes: string | null
          is_favorite: boolean
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          status: 'want_to_read' | 'reading' | 'read' | 'dnf'
          current_page?: number | null
          started_at?: string | null
          finished_at?: string | null
          rating?: number | null
          review?: string | null
          notes?: string | null
          is_favorite?: boolean
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          book_id?: string
          status?: 'want_to_read' | 'reading' | 'read' | 'dnf'
          current_page?: number | null
          started_at?: string | null
          finished_at?: string | null
          rating?: number | null
          review?: string | null
          notes?: string | null
          is_favorite?: boolean
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      clubs: {
        Row: {
          id: string
          name: string
          description: string | null
          cover_url: string | null
          created_by: string
          is_public: boolean
          join_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          cover_url?: string | null
          created_by: string
          is_public?: boolean
          join_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          cover_url?: string | null
          created_by?: string
          is_public?: boolean
          join_code?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      club_members: {
        Row: {
          id: string
          club_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          club_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          joined_at?: string
        }
      }
      club_books: {
        Row: {
          id: string
          club_id: string
          book_id: string
          status: 'upcoming' | 'current' | 'finished'
          start_date: string | null
          target_finish_date: string | null
          discussion_notes: string | null
          added_by: string
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          book_id: string
          status: 'upcoming' | 'current' | 'finished'
          start_date?: string | null
          target_finish_date?: string | null
          discussion_notes?: string | null
          added_by: string
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          book_id?: string
          status?: 'upcoming' | 'current' | 'finished'
          start_date?: string | null
          target_finish_date?: string | null
          discussion_notes?: string | null
          added_by?: string
          created_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          user_id: string
          action: string
          book_id: string | null
          club_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          book_id?: string | null
          club_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          book_id?: string | null
          club_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
    }
  }
}
