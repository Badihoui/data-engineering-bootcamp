export type BlockType = 'markdown' | 'code' | 'diagram' | 'solution' | 'exercise'

export interface Block {
  type: BlockType
  md?: string
  lang?: string
  code?: string
  key?: string
  title?: string
  summary?: string
  children?: Block[]
}

export type DiagramFormat =
  | 'mermaid'
  | 'svg'
  | 'tree'
  | 'stack'
  | 'panels'
  | 'callout'
  | 'ascii'

export interface TreeNode {
  label: string
  note: string
  children: TreeNode[]
}

export interface Diagram {
  key: string
  title: string
  caption: string
  fmt: DiagramFormat
  mermaid: string
  svg: string
  source_ascii: string
  data: {
    kind?: string
    root?: string
    nodes?: TreeNode[]
    title?: string
    rows?: { label: string; detail: string }[]
    panels?: { title: string; lines: string[]; caption?: string }[]
    body?: { kind: 'bullet' | 'heading' | 'text'; text: string; indent: number }[]
  }
}

export interface Track {
  id: number
  slug: string
  title: string
  subtitle: string
  description: string
  order: number
  color: string
  accent: string
  icon: string
  objectives: string[]
  outcomes: string[]
  prerequisites: string
  estimated_weeks: number
  module_count: number
  total_minutes: number
  modules?: Module[]
}

export interface Module {
  id: number
  slug: string
  number: number
  order: number
  title: string
  subtitle: string
  summary: string
  kind: 'course' | 'project'
  icon: string
  tags: string[]
  estimated_minutes: number
  difficulty: number
  colab_url: string
  notebook_path: string
  lesson_count: number
  has_quiz: boolean
  track_slug: string
  track_title: string
  track_color: string
  objectives?: string[]
  prerequisites?: string[]
  lessons?: LessonSummary[]
  resources?: Resource[]
  quiz?: Quiz | null
}

export interface Resource {
  title: string
  url: string
  kind: string
  description: string
}

export interface LessonSummary {
  id: number
  slug: string
  order: number
  title: string
  summary: string
  estimated_minutes: number
  xp_reward: number
  has_code: boolean
  has_diagram: boolean
  has_exercise: boolean
}

export interface Lesson extends LessonSummary {
  blocks: Block[]
  module_slug: string
  module_title: string
  module_number: number
  track_slug: string
  diagrams: Record<string, Diagram>
  neighbours: {
    previous: { slug: string; title: string; order: number } | null
    next: { slug: string; title: string; order: number } | null
  }
}

export interface Choice {
  id: number
  label: string
  text: string
}

export interface Question {
  id: number
  order: number
  kind: 'mcq' | 'open'
  prompt: string
  choices: Choice[]
  explanation: string
}

export interface Quiz {
  id: number
  title: string
  description: string
  pass_score: number
  xp_reward: number
  question_count: number
  graded_count: number
  questions: Question[]
}

export interface QuizResult {
  attempt: {
    id: number
    score: number
    correct_count: number
    total_count: number
    passed: boolean
    created_at: string
  }
  details: {
    question_id: number
    given_choice_id: number | null
    correct_choice_id: number | null
    is_correct: boolean
    explanation: string
  }[]
  awarded_xp: number
  xp: number
  new_badges: BadgeInfo[]
}

export interface BadgeInfo {
  slug: string
  name: string
  description: string
  icon: string
  color: string
  rule: string
  threshold: number
}

export interface User {
  id: number
  email: string
  username: string
  display_name: string
  avatar_url: string
  bio: string
  job_title: string
  xp: number
  current_streak: number
  longest_streak: number
  weekly_goal_minutes: number
  date_joined: string
  badges: { badge: BadgeInfo; unlocked_at: string }[]
}

export interface ModuleStats {
  done: number
  total: number
  percent: number
  quiz_passed: boolean
  completed: boolean
}

export interface Dashboard {
  xp: number
  current_streak: number
  longest_streak: number
  lessons_done: number
  lessons_total: number
  percent: number
  modules_completed: number
  modules_total: number
  quizzes_passed: number
  seconds_spent: number
  tracks: Record<
    string,
    {
      title: string
      color: string
      done: number
      total: number
      percent: number
      modules: number
      modules_done: number
    }
  >
  recent: {
    lesson_slug: string
    lesson_title: string
    module_slug: string
    module_title: string
    status: string
    updated_at: string
  }[]
  next_lesson: {
    lesson_slug: string
    lesson_title: string
    module_slug: string
    module_title: string
    track_slug: string
  } | null
}

export interface CatalogStats {
  tracks: number
  modules: number
  projects: number
  lessons: number
  quizzes: number
  total_minutes: number
  diagrams: number
  diagrams_converted: number
}

export interface ProgressSnapshot {
  lessons: {
    id: number
    lesson: number
    lesson_slug: string
    module_slug: string
    status: 'in_progress' | 'completed'
    seconds_spent: number
    scroll_ratio: number
    completed_at: string | null
  }[]
  modules: Record<string, ModuleStats>
}

export interface Note {
  id: number
  lesson: number
  lesson_slug: string
  lesson_title: string
  module_slug: string
  module_title: string
  body: string
  created_at: string
  updated_at: string
}

export interface Bookmark {
  id: number
  module: number
  module_slug: string
  module_title: string
  created_at: string
}

export interface Flashcard {
  id: number
  question: number
  prompt: string
  kind: 'mcq' | 'open'
  explanation: string
  choices: Choice[]
  correct_label: string
  module_slug: string
  module_title: string
  ease_factor: number
  interval_days: number
  repetitions: number
  lapses: number
  due_on: string
  last_grade: number | null
  is_new: boolean
}

export interface FlashcardStats {
  due: number
  learning: number
  mature: number
  scheduled: number
  available: number
  new: number
  lapses: number
}

export interface LeaderboardEntry {
  rank: number
  display_name: string
  avatar_url: string
  xp: number
  current_streak: number
  is_me: boolean
}

export interface Certificate {
  track_slug: string
  track_title: string
  track_color: string
  modules_total: number
  modules_completed: number
  earned: boolean
  earned_on: string | null
  hours: number
}
