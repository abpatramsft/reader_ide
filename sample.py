"""
Simple GitHub Copilot SDK Chat
Takes user queries and responds using Copilot's built-in tools + MCP servers.
"""

import asyncio
import sys
from copilot import CopilotClient
from copilot.generated.session_events import SessionEventType


def handle_event(event):
    """Print streaming responses and tool call events."""
    
    if event.type == SessionEventType.ASSISTANT_MESSAGE_DELTA:
        sys.stdout.write(event.data.delta_content)
        sys.stdout.flush()
    
    elif event.type == SessionEventType.TOOL_EXECUTION_START:
        print(f"\n\n🔧 [TOOL] {event.data.tool_name}")
        if hasattr(event.data, 'arguments') and event.data.arguments:
            print(f"   Args: {event.data.arguments}\n")
    
    elif event.type == SessionEventType.TOOL_EXECUTION_COMPLETE:
        print(f"✅ [DONE] {event.data.tool_name}\n")
    
    elif event.type == SessionEventType.SESSION_ERROR:
        print(f"\n❌ Error: {event.data.message}")
    
    elif event.type == SessionEventType.SESSION_IDLE:
        print()


async def main():
    print("GitHub Copilot SDK Chat")
    print("=" * 40)
    print("Type 'exit' to quit\n")
    
    client = CopilotClient()
    await client.start()
    
    session = await client.create_session({
        "model": "gpt-4.1",
        "streaming": True,
        # Add MCP servers here if needed:
        "mcp_servers": {
            # "github": {
            #     "type": "http",
            #     "url": "https://api.githubcopilot.com/mcp/",
            # },
            "workiq": {
                "type": "local",
                "command": "npx",
                "args": ["-y", "@microsoft/workiq", "mcp"],
                "tools": ["*"],
            },
        },
    })
    
    session.on(handle_event)
    
    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        
        if not user_input:
            continue
        if user_input.lower() == "exit":
            break
        
        print("\nAssistant: ", end="")
        await session.send_and_wait({"prompt": user_input})
        print()
    
    print("Goodbye!")
    await client.stop()


if __name__ == "__main__":
    asyncio.run(main())
