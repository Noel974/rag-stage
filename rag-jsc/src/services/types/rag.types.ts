
export interface AskSource {
  n: number;
  name: string;
  link: string | null;
  location: string | null;
  score: number;
  excerpt: string;
}

export interface AskDocument {
  drive_id: string;
  name: string;
  view_url: string | null;
  download_url: string;
}

export interface AskResponse {
  answer?: string;
  error?: string;
  sources?: AskSource[];
  documents?: AskDocument[];
}

export type IndexingStatus = Record<string, unknown>;
