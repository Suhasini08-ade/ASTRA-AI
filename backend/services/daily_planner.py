"""
services/daily_planner.py
=========================
Intelligent daily schedule planner for ASTRA AI.

Fetches and analyzes all real authenticated user data from MongoDB:
- Tasks (status, priority, deadlines)
- Calendar Events (start/end times, conflicts, locked commitments)
- Reminders (due times, active status)
- Notes (context, tags, action items)

Analyzes:
- Urgent tasks and deadlines
- Calendar commitments and overlaps/conflicts
- Available open time blocks between meetings
- Generates a realistic, time-blocked plan with breaks (lunch, short breaks)
- Produces:
  1. Full Markdown schedule for UI display
  2. Concise, natural spoken summary for voice assistant TTS
"""

import asyncio
from datetime import datetime, time, timedelta, timezone
import logging
import re
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from backend.services.agent_tools import _format_human_datetime

logger = logging.getLogger(__name__)


def is_plan_my_day_command(text: str) -> bool:
    """Identify if user query is a request to plan their day or daily schedule."""
    if not text:
        return False
    lowered = text.strip().lower()
    patterns = [
        r"\bplan\s+(?:my|the|our)?\s*day\b",
        r"\bplan\s+(?:my|the)?\s*schedule\b",
        r"\bplan\s+today\b",
        r"\bcreate\s+(?:a\s+)?(?:daily\s+)?(?:plan|schedule)\b",
        r"\bmake\s+(?:a\s+)?(?:daily\s+)?(?:plan|schedule)\b",
        r"\bwhat\s+should\s+i\s+(?:do|work\s+on)\s+today\b",
        r"\borgani[sz]e\s+my\s+day\b",
        r"\bdaily\s+schedule\b",
        r"\bdaily\s+plan\b",
        r"\bhelp\s+me\s+plan\s+(?:my\s+)?day\b",
        r"\bschedule\s+my\s+day\b",
        r"\bwhat(?:'s|\s+is)\s+my\s+plan\s+for\s+today\b",
    ]
    return any(re.search(p, lowered) for p in patterns)


def _parse_dt(val: Any) -> datetime | None:
    """Parse various datetime representations into a timezone-aware UTC datetime."""
    if not val:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
    if isinstance(val, str):
        try:
            # Handle ISO formats
            clean = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            return None
    return None


def _format_time_only(dt: datetime) -> str:
    """Format datetime into standard 12-hour time string (e.g. 10:30 AM)."""
    hour = dt.hour % 12
    if hour == 0:
        hour = 12
    period = "AM" if dt.hour < 12 else "PM"
    return f"{hour:02d}:{dt.minute:02d} {period}"


class DailyPlanningService:
    """Orchestrates comprehensive real-data daily planning for authenticated users."""

    async def fetch_user_data(
        self, db: AsyncIOMotorDatabase, user_id: str
    ) -> dict[str, list[dict[str, Any]]]:
        """Fetch real authenticated user data from all productivity collections in MongoDB."""
        str_id = str(user_id)
        # Support both string ID and ObjectId representations in MongoDB
        query = {"$or": [{"user_id": str_id}, {"user_id": user_id}]}

        tasks_task = (
            db.tasks.find(query)
            .sort([("priority", -1), ("due_date", 1)])
            .to_list(length=100)
        )
        events_task = (
            db.calendar_events.find(query)
            .sort("start_time", 1)
            .to_list(length=100)
        )
        reminders_task = (
            db.reminders.find({**query, "is_active": {"$ne": False}})
            .sort("due_time", 1)
            .to_list(length=100)
        )
        notes_task = (
            db.notes.find(query)
            .sort("updated_at", -1)
            .to_list(length=20)
        )

        try:
            tasks, events, reminders, notes = await asyncio.gather(
                tasks_task, events_task, reminders_task, notes_task
            )
        except Exception as exc:
            logger.error("Failed to fetch user productivity data for daily planning: %s", exc)
            tasks, events, reminders, notes = [], [], [], []

        return {
            "tasks": tasks or [],
            "events": events or [],
            "reminders": reminders or [],
            "notes": notes or [],
        }

    def analyze_data(
        self, data: dict[str, list[dict[str, Any]]], now: datetime
    ) -> dict[str, Any]:
        """Analyze tasks, events, reminders, notes, and detect conflicts & priorities."""
        tasks = data.get("tasks", [])
        events = data.get("events", [])
        reminders = data.get("reminders", [])
        notes = data.get("notes", [])

        today_date = now.date()

        # 1. Filter Pending Tasks & Identify Urgency
        pending_tasks = [t for t in tasks if t.get("status") != "done"]
        urgent_tasks = []
        normal_tasks = []

        for t in pending_tasks:
            due_dt = _parse_dt(t.get("due_date"))
            priority = str(t.get("priority") or "medium").lower()
            is_urgent = False

            if priority == "high":
                is_urgent = True
            elif due_dt and due_dt.date() <= today_date:
                is_urgent = True

            if is_urgent:
                urgent_tasks.append({**t, "parsed_due": due_dt})
            else:
                normal_tasks.append({**t, "parsed_due": due_dt})

        # 2. Filter Calendar Events for Today & Detect Conflicts
        parsed_events = []
        for e in events:
            s_dt = _parse_dt(e.get("start_time"))
            e_dt = _parse_dt(e.get("end_time"))
            if s_dt and e_dt:
                # Include events that occur today
                if s_dt.date() == today_date or e_dt.date() == today_date:
                    parsed_events.append({
                        **e,
                        "parsed_start": s_dt,
                        "parsed_end": e_dt,
                    })

        parsed_events.sort(key=lambda x: x["parsed_start"])

        # Detect Conflicts between overlapping events
        conflicts = []
        for i in range(len(parsed_events) - 1):
            e1 = parsed_events[i]
            e2 = parsed_events[i + 1]
            if e2["parsed_start"] < e1["parsed_end"]:
                conflicts.append({
                    "event_a": e1.get("title", "Event 1"),
                    "time_a": f"{_format_time_only(e1['parsed_start'])} - {_format_time_only(e1['parsed_end'])}",
                    "event_b": e2.get("title", "Event 2"),
                    "time_b": f"{_format_time_only(e2['parsed_start'])} - {_format_time_only(e2['parsed_end'])}",
                })

        # 3. Filter Reminders for Today
        parsed_reminders = []
        for r in reminders:
            r_dt = _parse_dt(r.get("due_time"))
            if r_dt:
                parsed_reminders.append({
                    **r,
                    "parsed_due": r_dt,
                    "is_today": r_dt.date() == today_date,
                })
            else:
                parsed_reminders.append({
                    **r,
                    "parsed_due": None,
                    "is_today": True,
                })

        return {
            "pending_tasks": pending_tasks,
            "urgent_tasks": urgent_tasks,
            "normal_tasks": normal_tasks,
            "today_events": parsed_events,
            "conflicts": conflicts,
            "reminders": parsed_reminders,
            "notes": notes,
        }

    def build_schedule_blocks(
        self, analysis: dict[str, Any], now: datetime
    ) -> list[dict[str, str]]:
        """Construct realistic time-blocked schedule integrating events, tasks, and breaks."""
        events = analysis["today_events"]
        urgent_tasks = analysis["urgent_tasks"]
        normal_tasks = analysis["normal_tasks"]
        reminders = analysis["reminders"]

        schedule = []
        task_queue = list(urgent_tasks) + list(normal_tasks)

        # Baseline standard day boundaries (9:00 AM to 6:00 PM)
        # Adapt start if an early meeting exists
        day_start_hour = 9
        if events and events[0]["parsed_start"].hour < 9:
            day_start_hour = max(7, events[0]["parsed_start"].hour)

        # Slot 1: Morning Deep Focus Block 1 (e.g. 09:00 AM - 10:30 AM)
        m1_event = next(
            (e for e in events if e["parsed_start"].hour < 11 and e["parsed_start"].hour >= 9),
            None,
        )
        if m1_event:
            s_str = _format_time_only(m1_event["parsed_start"])
            e_str = _format_time_only(m1_event["parsed_end"])
            schedule.append({
                "time": f"{s_str} - {e_str}",
                "tag": "📅 Calendar Commitment",
                "title": m1_event.get("title", "Meeting"),
                "details": m1_event.get("description", "Scheduled calendar event"),
            })
        elif task_queue:
            t = task_queue.pop(0)
            p_label = f"Priority: {t.get('priority', 'high').upper()}"
            schedule.append({
                "time": "09:00 AM - 10:30 AM",
                "tag": "🎯 Deep Focus",
                "title": t.get("title", "Priority Task"),
                "details": f"Focused work on {t.get('title')}. ({p_label})",
            })
        else:
            schedule.append({
                "time": "09:00 AM - 10:30 AM",
                "tag": "🎯 Deep Focus",
                "title": "Open Productivity Block",
                "details": "High-leverage focus on core projects and planning.",
            })

        # Slot 2: Mid-Morning Refresh Break
        schedule.append({
            "time": "10:30 AM - 10:45 AM",
            "tag": "☕ Refresh Break",
            "title": "Coffee, Hydration & Screen Break",
            "details": "Step away from screen, hydrate, and stretch.",
        })

        # Slot 3: Mid-Morning Execution Block (10:45 AM - 12:30 PM)
        m2_event = next(
            (e for e in events if e["parsed_start"].hour >= 10 and e["parsed_start"].hour < 13 and e != m1_event),
            None,
        )
        if m2_event:
            s_str = _format_time_only(m2_event["parsed_start"])
            e_str = _format_time_only(m2_event["parsed_end"])
            schedule.append({
                "time": f"{s_str} - {e_str}",
                "tag": "📅 Calendar Commitment",
                "title": m2_event.get("title", "Meeting"),
                "details": m2_event.get("description", "Scheduled calendar event"),
            })
        elif task_queue:
            t = task_queue.pop(0)
            schedule.append({
                "time": "10:45 AM - 12:30 PM",
                "tag": "⚡ Task Execution",
                "title": t.get("title", "Task"),
                "details": f"Work on {t.get('title')}. {t.get('description', '')}".strip(),
            })
        else:
            schedule.append({
                "time": "10:45 AM - 12:30 PM",
                "tag": "⚡ Task Execution",
                "title": "Project Execution & Review",
                "details": "Review notes and clear communication inbox.",
            })

        # Slot 4: Lunch Break & Mental Recharge (12:30 PM - 01:30 PM)
        schedule.append({
            "time": "12:30 PM - 01:30 PM",
            "tag": "🥗 Lunch & Rest",
            "title": "Lunch Break & Healthy Recharge",
            "details": "Nourishing meal and away-from-desk walk.",
        })

        # Slot 5: Afternoon Focus Block 1 (01:30 PM - 03:30 PM)
        a1_event = next(
            (e for e in events if e["parsed_start"].hour >= 13 and e["parsed_start"].hour < 16 and e not in (m1_event, m2_event)),
            None,
        )
        if a1_event:
            s_str = _format_time_only(a1_event["parsed_start"])
            e_str = _format_time_only(a1_event["parsed_end"])
            schedule.append({
                "time": f"{s_str} - {e_str}",
                "tag": "📅 Calendar Commitment",
                "title": a1_event.get("title", "Meeting"),
                "details": a1_event.get("description", "Scheduled calendar event"),
            })
        elif task_queue:
            t = task_queue.pop(0)
            schedule.append({
                "time": "01:30 PM - 03:30 PM",
                "tag": "⚡ Afternoon Deep Work",
                "title": t.get("title", "Task"),
                "details": f"Focused progress on {t.get('title')}.",
            })
        else:
            schedule.append({
                "time": "01:30 PM - 03:30 PM",
                "tag": "⚡ Afternoon Deep Work",
                "title": "Deep Focus Work",
                "details": "Uninterrupted block for strategic initiatives.",
            })

        # Slot 6: Afternoon Break (03:30 PM - 03:45 PM)
        schedule.append({
            "time": "03:30 PM - 03:45 PM",
            "tag": "🥤 Recharge Break",
            "title": "Quick Stretch & Hydration",
            "details": "Rest eyes, movement break, and light hydration.",
        })

        # Slot 7: Secondary Tasks & Reminders (03:45 PM - 05:00 PM)
        if task_queue:
            t = task_queue.pop(0)
            schedule.append({
                "time": "03:45 PM - 05:00 PM",
                "tag": "📌 Secondary Focus",
                "title": t.get("title", "Task"),
                "details": f"Work on {t.get('title')}.",
            })
        else:
            schedule.append({
                "time": "03:45 PM - 05:00 PM",
                "tag": "📌 Collaborative Block",
                "title": "Follow-ups, Notes & Organization",
                "details": "Synthesize recent notes and follow up on pending items.",
            })

        # Slot 8: Daily Wrap-Up & Tomorrow Planning (05:00 PM - 05:30 PM)
        schedule.append({
            "time": "05:00 PM - 05:30 PM",
            "tag": "📋 Daily Wrap-Up",
            "title": "Review Accomplishments & Prep Tomorrow",
            "details": "Log completed tasks, update notes, and prepare tomorrow's schedule.",
        })

        return schedule

    def format_plan_markdown(
        self,
        analysis: dict[str, Any],
        schedule_blocks: list[dict[str, str]],
        now: datetime,
    ) -> str:
        """Format the full rich markdown schedule with metadata, priorities, and breaks."""
        day_str = now.strftime("%A, %B %d, %Y")
        urgent_tasks = analysis["urgent_tasks"]
        normal_tasks = analysis["normal_tasks"]
        pending_tasks = analysis["pending_tasks"]
        events = analysis["today_events"]
        conflicts = analysis["conflicts"]
        reminders = analysis["reminders"]
        notes = analysis["notes"]

        md_parts = [
            f"# 🗓️ Personalized Daily Plan — {day_str}\n",
            "### 📊 Today's Data Overview",
            f"- **Pending Tasks:** {len(pending_tasks)} active ({len(urgent_tasks)} High Priority/Urgent)",
            f"- **Calendar Commitments:** {len(events)} scheduled",
            f"- **Active Reminders:** {len(reminders)} alerts",
            f"- **User Notes:** {len(notes)} reference items available\n",
        ]

        # 1. Urgent Priorities Section
        md_parts.append("### 🚨 Urgent Priorities & Deadlines")
        if urgent_tasks:
            for idx, t in enumerate(urgent_tasks, 1):
                p_badge = t.get("priority", "high").upper()
                due_info = ""
                if t.get("due_date"):
                    due_human = _format_human_datetime(t.get("due_date")) or "Today"
                    due_info = f" (Due: {due_human})"
                desc = f" — *{t.get('description')}*" if t.get("description") else ""
                md_parts.append(f"{idx}. **{t.get('title')}** `[{p_badge}]`{due_info}{desc}")
        elif pending_tasks:
            top_t = pending_tasks[0]
            md_parts.append(f"1. **{top_t.get('title')}** `[{top_t.get('priority', 'medium').upper()}]` — Priority task for today.")
        else:
            md_parts.append("✨ *No overdue or high-priority tasks pending in your database. Great job!*")

        if normal_tasks:
            md_parts.append("\n**Other Active Tasks to Progress:**")
            for t in normal_tasks[:5]:
                p_badge = (t.get("priority") or "medium").upper()
                desc = f" — *{t.get('description')}*" if t.get("description") else ""
                md_parts.append(f"- **{t.get('title')}** `[{p_badge}]`{desc}")
        md_parts.append("")

        # 2. Calendar Commitments & Conflict Analysis
        md_parts.append("### 📅 Calendar & Conflict Analysis")
        if conflicts:
            md_parts.append("⚠️ **Scheduling Conflict Detected:**")
            for c in conflicts:
                md_parts.append(f"- Overlap between **'{c['event_a']}'** ({c['time_a']}) and **'{c['event_b']}'** ({c['time_b']}). *Consider adjusting one meeting.*")
        elif events:
            md_parts.append("✅ **No conflicts detected.** Scheduled commitments:")
            for e in events:
                s_str = _format_time_only(e["parsed_start"])
                e_str = _format_time_only(e["parsed_end"])
                md_parts.append(f"- **{e.get('title')}**: `{s_str} - {e_str}`")
        else:
            md_parts.append("✅ **Calendar is clear today.** 0 meetings scheduled. Open focus time available.")
        md_parts.append("")

        # 3. Optimized Time-Blocked Schedule
        md_parts.append("### ⏰ Optimized Time-Blocked Schedule")
        for block in schedule_blocks:
            md_parts.append(
                f"- **{block['time']}** — `{block['tag']}` **{block['title']}**\n  *{block['details']}*"
            )
        md_parts.append("")

        # 4. Active Reminders & Notes Context
        if reminders or notes:
            md_parts.append("### 💡 Reminders & Actionable Notes")
            if reminders:
                md_parts.append("**Today's Reminders:**")
                for r in reminders[:4]:
                    r_human = f" ({_format_human_datetime(r.get('due_time'))})" if r.get("due_time") else ""
                    md_parts.append(f"- ⏰ {r.get('message')}{r_human}")
            if notes:
                md_parts.append("\n**Recent Reference Notes:**")
                for n in notes[:3]:
                    md_parts.append(f"- 📝 **{n.get('title')}**: {n.get('content', '')[:100]}...")
            md_parts.append("")

        return "\n".join(md_parts)

    def generate_spoken_summary(
        self, analysis: dict[str, Any], schedule_blocks: list[dict[str, str]]
    ) -> str:
        """Produce a concise, natural spoken summary suitable for text-to-speech."""
        urgent_tasks = analysis["urgent_tasks"]
        pending_tasks = analysis["pending_tasks"]
        events = analysis["today_events"]
        conflicts = analysis["conflicts"]

        task_count = len(pending_tasks)
        event_count = len(events)

        event_phrase = f"{event_count} calendar event{'s' if event_count != 1 else ''}"
        task_phrase = f"{task_count} pending task{'s' if task_count != 1 else ''}"

        top_priority = ""
        if urgent_tasks:
            top_priority = f"Your top priority is {urgent_tasks[0].get('title')}."
        elif pending_tasks:
            top_priority = f"Your main task is {pending_tasks[0].get('title')}."

        conflict_phrase = ""
        if conflicts:
            conflict_phrase = " Please note there is an overlapping meeting conflict to review."

        spoken = (
            f"I have created your personalized daily schedule based on your {event_phrase} and {task_phrase}. "
            f"{top_priority} "
            f"I have scheduled focused deep work blocks with built-in breaks around your commitments.{conflict_phrase} "
            "Your complete itinerary is displayed on screen."
        )

        return spoken.strip()

    async def generate_daily_plan(
        self, db: AsyncIOMotorDatabase, user_id: str
    ) -> dict[str, str]:
        """End-to-end generator fetching real user database data and returning full plan + speech summary."""
        now = datetime.now(timezone.utc)
        user_data = await self.fetch_user_data(db, user_id)
        analysis = self.analyze_data(user_data, now)
        schedule_blocks = self.build_schedule_blocks(analysis, now)

        full_plan = self.format_plan_markdown(analysis, schedule_blocks, now)
        spoken_summary = self.generate_spoken_summary(analysis, schedule_blocks)

        return {
            "reply": full_plan,
            "spoken_summary": spoken_summary,
        }


# Module singleton
daily_planner = DailyPlanningService()
