"""Minimal, read-only schemas for ASTRA Intelligence Engine context."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class IntelligenceRequest(BaseModel):
    """A request received from an already-authenticated ASTRA user."""

    message: str = Field(..., min_length=1, max_length=5000)


class TaskContext(BaseModel):
    id: str
    title: str
    description: str = ""
    due_date: datetime | None = None
    priority: str = "medium"
    status: str = "todo"


class CalendarContext(BaseModel):
    id: str
    title: str
    description: str = ""
    start_time: datetime | None = None
    end_time: datetime | None = None


class ReminderContext(BaseModel):
    id: str
    message: str
    due_time: datetime | None = None
    repeat: str | None = None
    is_active: bool = True


class NoteContext(BaseModel):
    id: str
    title: str
    content: str = ""
    tags: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None


class FocusContext(BaseModel):
    id: str
    task_id: str | None = None
    task_title: str = ""
    duration_seconds: int = 0
    status: str = ""
    timestamp: datetime | None = None


class IntelligenceContext(BaseModel):
    """Bounded, user-owned information selected for one request."""

    request: IntelligenceRequest
    current_time: datetime
    relevant_categories: list[str] = Field(default_factory=list)
    tasks: list[TaskContext] = Field(default_factory=list)
    calendar_events: list[CalendarContext] = Field(default_factory=list)
    reminders: list[ReminderContext] = Field(default_factory=list)
    notes: list[NoteContext] = Field(default_factory=list)
    focus_sessions: list[FocusContext] = Field(default_factory=list)
    relevant_settings: dict[str, object] = Field(default_factory=dict)
    recent_chat: list[dict[str, object]] = Field(default_factory=list)


class IntelligenceResult(BaseModel):
    """One bounded result from the deterministic Intelligence Engine pipeline."""

    context: IntelligenceContext
    decision: "Decision | None" = None
    plan: "ExecutionPlan | None" = None
    execution: "ActionExecutionResult | None" = None
    explanation: "IntelligenceExplanation | None" = None
    status: str = "context_built"
    reasons: list[str] = Field(default_factory=list)


class DecisionCategory(str, Enum):
    """Deterministic classifications emitted before any future planning."""

    CONVERSATIONAL = "conversational"
    READ = "read"
    ANALYZE = "analyze"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    MULTI_ACTION = "multi_action"
    UNKNOWN = "unknown"


class DecisionOperation(str, Enum):
    READ = "read"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    ANALYZE = "analyze"


class DecisionAction(BaseModel):
    """One intended existing tool action; this model never executes it."""

    action_name: str | None = None
    resource_type: str
    operation: DecisionOperation
    supported: bool
    confirmation_required: bool = False


class DecisionReason(BaseModel):
    message: str


class Decision(BaseModel):
    """Explainable result of deterministic request classification."""

    category: DecisionCategory
    actions: list[DecisionAction] = Field(default_factory=list)
    confirmation_required: bool = False
    requires_clarification: bool = False
    supported: bool = True
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    reasons: list[DecisionReason] = Field(default_factory=list)


class PlanStatus(str, Enum):
    """The safe state of a deterministic, non-executing plan."""

    READY = "ready"
    REQUIRES_CONFIRMATION = "requires_confirmation"
    REQUIRES_CLARIFICATION = "requires_clarification"
    UNSUPPORTED = "unsupported"
    NO_ACTION = "no_action"


class PlanStep(BaseModel):
    """A validated existing agent-tool action that has not been executed."""

    id: str
    action_name: str
    resource_type: str
    operation: DecisionOperation
    depends_on: list[str] = Field(default_factory=list)
    confirmation_required: bool = False


class PlanReason(BaseModel):
    """Human-readable explanation for a plan state or step."""

    message: str


class ExecutionPlan(BaseModel):
    """A deterministic execution proposal; creating it never performs an action."""

    status: PlanStatus
    steps: list[PlanStep] = Field(default_factory=list)
    confirmation_required: bool = False
    requires_clarification: bool = False
    supported: bool = True
    reasons: list[PlanReason] = Field(default_factory=list)


class ActionExecutionStatus(str, Enum):
    """Terminal state for an explicitly requested Phase 4 plan execution."""

    COMPLETED = "completed"
    REQUIRES_CONFIRMATION = "requires_confirmation"
    REQUIRES_CLARIFICATION = "requires_clarification"
    UNSUPPORTED = "unsupported"
    FAILED = "failed"
    NO_ACTION = "no_action"


class ActionExecutionStep(BaseModel):
    """Recorded outcome for one plan step after the executor attempts it."""

    step_id: str
    action_name: str
    succeeded: bool
    result: dict[str, object] | None = None
    error: str | None = None


class ActionExecutionResult(BaseModel):
    """Execution output without any AI-generated interpretation."""

    status: ActionExecutionStatus
    steps: list[ActionExecutionStep] = Field(default_factory=list)
    confirmation_required: bool = False
    requires_clarification: bool = False
    supported: bool = True
    error: str | None = None


class ContextExplanation(BaseModel):
    """Safe aggregate of one context category; raw user data is never exposed."""

    category: str
    item_count: int
    description: str


class ActionExplanation(BaseModel):
    """Safe description of an action selected by the decision engine."""

    operation: DecisionOperation
    resource_type: str
    supported: bool
    confirmation_required: bool = False


class PlanStepExplanation(BaseModel):
    """Safe summary of a proposed step and its ordering requirement."""

    step_id: str
    operation: DecisionOperation
    resource_type: str
    depends_on: list[str] = Field(default_factory=list)
    confirmation_required: bool = False


class ExecutionExplanation(BaseModel):
    """Safe aggregate of execution outcomes without raw tool responses."""

    status: ActionExecutionStatus
    completed_steps: int = 0
    failed_steps: int = 0
    message: str


class IntelligenceExplanation(BaseModel):
    """Deterministic, safe explanation derived only from pipeline artifacts."""

    understanding: str
    relevant_context: list[ContextExplanation] = Field(default_factory=list)
    decision: DecisionCategory
    selected_actions: list[ActionExplanation] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    confirmation_required: bool = False
    planned_steps: list[PlanStepExplanation] = Field(default_factory=list)
    execution_result: ExecutionExplanation | None = None
