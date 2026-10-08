"""
Base class for all tools in the registry.
Kept in its own file to avoid circular imports.
"""

class BaseTool:
    name: str
    description: str
    parameters_description: str

    def run(self, argument: str) -> str:
        raise NotImplementedError
