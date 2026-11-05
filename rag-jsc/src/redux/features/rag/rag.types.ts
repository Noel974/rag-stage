
import type {
    AskResponse,
    IndexingStatus,
} from "../../../services/types/rag.types";

export interface RagState {
  answer: AskResponse | null;
  indexingStatus: IndexingStatus | null;

  questionLoading: boolean;
  statusLoading: boolean;

  questionError: string | null;
  statusError: string | null;

  currentRequestId: string | null;
}
