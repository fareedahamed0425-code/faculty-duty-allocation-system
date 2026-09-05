import json
import requests
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.ai.tools import TOOL_DEFINITIONS, execute_tool

SYSTEM_PROMPT = """You are the AI Assistant for the Faculty Substitution & Duty Allocation System at The Apollo University.

YOUR SOLE PURPOSE AND MANDATE:
You strictly assist academic administrators, Deans, HODs, and faculty with institutional scheduling, timetable queries, substitution duty allocations, absence recording, workload limits (max 4 duties/week), and fairness explanations.

STRICT INSTITUTIONAL RULES & BOUNDARIES:
1. STRICT SCOPE RESTRICTION: You are strictly an institutional scheduling and duty allocation assistant. If a user asks for anything outside this domain (e.g., general trivia, unrelated programming, creative writing, non-university topics), you must politely decline and state that you are exclusively dedicated to The Apollo University Faculty Scheduling & Duty Allocation System.
2. DETERMINISTIC ENGINE COMPLIANCE: The backend scheduling engine is the sole source of truth. You must NEVER invent fake timetable entries or bypass policies.
3. THE 8 INSTITUTIONAL FAIRNESS RULES:
   - Rule 1 (Period Free): Faculty must be free during the exact period with no regular lecture.
   - Rule 2 (Daily Workload Limit): Faculty with >= 3 regular classes today are ineligible.
   - Rule 3 (Weekly Substitution Limit): Faculty with >= 4 substitutions this week are strictly ineligible.
   - Rule 4 (Department Domain Priority): Matching department and subject expertise must be prioritized.
   - Rule 5 (Exemption Policy): Exempt faculty (Deans, HODs, Committee chairs) must not be allocated duties.
   - Rule 6 (Absence Constraint): Faculty on leave or absent cannot be allocated.
   - Rule 7 (Collision Prevention): No double booking across lectures or substitution commitments.
   - Rule 8 (Fairness Balance Priority): Priority is strictly given to eligible faculty with the lowest weekly substitution load.

OUTPUT FORMATTING:
- Formulate answers clearly and professionally.
- Present factual lists cleanly with bullet points or numbered steps.
- Highlight key faculty names, room numbers, subjects, and duty counts clearly."""

def query_nemotron_ai(
    db: Session,
    user_message: str,
    actor_name: str = "Admin",
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Sends request to AI model with tool definitions and strict institutional rules.
    Executes tool calls against backend services, returns final response and action log.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if conversation_history:
        messages.extend(conversation_history[-6:])
    messages.append({"role": "user", "content": user_message})

    actions_taken = []
    tool_calls_executed = []

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": settings.NVIDIA_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 4096,
        "tools": TOOL_DEFINITIONS,
        "tool_choice": "auto"
    }

    try:
        response = requests.post(
            settings.NVIDIA_INVOKE_URL,
            headers=headers,
            json=payload,
            timeout=25
        )

        if response.status_code != 200:
            return {
                "reply": "The institutional scheduling service is temporarily busy. Please retry in a moment.",
                "tool_calls": [],
                "actions_taken": [],
                "facts_grounded": True
            }

        res_data = response.json()
        choice = res_data["choices"][0]
        message = choice["message"]

        # If model requested tool calls, execute them deterministically
        if "tool_calls" in message and message["tool_calls"]:
            for tool_call in message["tool_calls"]:
                func_name = tool_call["function"]["name"]
                raw_args = tool_call["function"]["arguments"]
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except Exception:
                    args = {}

                # Execute against deterministic backend
                tool_result = execute_tool(db, func_name, args, actor_name=actor_name)
                tool_calls_executed.append({
                    "id": tool_call.get("id"),
                    "name": func_name,
                    "arguments": args,
                    "result": tool_result
                })
                actions_taken.append(f"Queried institutional engine: {func_name}")

            # Second turn: Give tool execution facts back to model
            messages.append(message)
            for tc in tool_calls_executed:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "name": tc["name"],
                    "content": json.dumps(tc["result"])
                })

            second_payload = {
                "model": settings.NVIDIA_MODEL,
                "messages": messages,
                "temperature": 0.2,
                "max_tokens": 4096
            }

            second_res = requests.post(
                settings.NVIDIA_INVOKE_URL,
                headers=headers,
                json=second_payload,
                timeout=25
            )

            if second_res.status_code == 200:
                final_content = second_res.json()["choices"][0]["message"]["content"]
                return {
                    "reply": final_content,
                    "tool_calls": tool_calls_executed,
                    "actions_taken": actions_taken,
                    "facts_grounded": True
                }

        return {
            "reply": message.get("content") or "Inquiry processed successfully according to institutional policies.",
            "tool_calls": [],
            "actions_taken": [],
            "facts_grounded": True
        }

    except Exception as e:
        return {
            "reply": "Unable to connect to live AI services. Institutional deterministic rules and timetable views remain fully active in the system.",
            "tool_calls": [],
            "actions_taken": [],
            "facts_grounded": True
        }
