import json
from datetime import date, datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from openai import OpenAI

from app.core.config import settings
from app.ai.tools import TOOL_DEFINITIONS, execute_tool

SYSTEM_PROMPT = """You are The Apollo University Assistant, an intelligent, helpful, and highly capable AI administrator for the Faculty Substitution & Duty Allocation System.
Your personality is professional, concise, yet friendly. You answer questions directly based on the user's intent rather than using rigid templates.

You have access to several backend tools to query faculty, absences, schedules, and more. 
CRITICAL: You are also responsible for automating duty allocations! If a user asks you to "automatically allocate" or "assign substitutes" for pending requirements, you MUST use the `get_unallocated_requirements` tool to find pending duties, and then use the `generate_allocation` tool on each requirement ID to allocate a faculty member automatically. The `generate_allocation` tool will enforce all 7 fairness constraints and send notifications automatically.

Here are the 7 institutional constraints for your awareness:
1. Slot Conflict: No regular lecture overlap.
2. Daily Limit: Max 2 regular classes per day.
3. Weekly Cap: Max 4 substitution duties per week.
4. Exemption: Deans, HODs, PCs are exempt.
5. Affinity: Prioritize same department/subject.
6. Spacing: Prioritize faculty with 0 duties on that day.
7. Equalizer: Prioritize faculty with fewest weekly duties.

When you use tools, summarize the actions you took and the results to the user in a natural, conversational way.
"""

def query_nemotron_ai(
    db: Session,
    user_message: str,
    actor_name: str = "Admin",
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Main AI handler: Answers user queries with dynamic AI conversational capabilities using OpenAI client.
    """
    
    # Ensure NVIDIA_INVOKE_URL is correct for openai client
    base_url = settings.NVIDIA_INVOKE_URL
    if base_url.endswith("/chat/completions"):
        base_url = base_url.replace("/chat/completions", "")
    elif base_url.endswith("/chat/completions/"):
        base_url = base_url.replace("/chat/completions/", "")
        
    # Initialize OpenAI client pointing to NVIDIA's API
    client = OpenAI(
        base_url=base_url,
        api_key=settings.NVIDIA_API_KEY
    )
    
    # Build messages
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]
    
    if conversation_history:
        messages.extend(conversation_history)
        
    # Append the latest user message with actor context
    messages.append({
        "role": "user",
        "content": f"[User: {actor_name}]\n{user_message}"
    })
    
    tools_executed = []
    actions = []
    
    # First pass: Ask the model
    try:
        response = client.chat.completions.create(
            model=settings.NVIDIA_MODEL,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=4000,
        )
        
        response_message = response.choices[0].message
        
        # Check if model wants to call tools
        if response_message.tool_calls:
            messages.append(response_message)
            
            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                
                try:
                    arguments = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    arguments = {}
                    
                # Execute the actual backend tool
                result = execute_tool(db, function_name, arguments, actor_name)
                
                tools_executed.append({
                    "name": function_name,
                    "arguments": arguments,
                    "result": result
                })
                actions.append(f"Executed {function_name}")
                
                # Append tool result to messages for the second pass
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": json.dumps(result, default=str)
                })
                
            # Second pass: Get final response after tool execution
            final_response = client.chat.completions.create(
                model=settings.NVIDIA_MODEL,
                messages=messages,
                temperature=0.3,
                max_tokens=4000
            )
            final_reply = final_response.choices[0].message.content
            
        else:
            final_reply = response_message.content
            
    except Exception as e:
        final_reply = f"I encountered an error connecting to my core systems: {str(e)}"
        
    return {
        "reply": final_reply or "I have processed your request.",
        "tool_calls": tools_executed,
        "actions_taken": actions,
        "facts_grounded": len(tools_executed) > 0
    }
