export function createUiLayer(className: string): HTMLDivElement {
  removeUiLayer();
  const root = document.createElement("div");
  root.id = "game-ui";
  root.className = className;
  const app = document.querySelector("#app") ?? document.body;
  app.appendChild(root);
  return root;
}

export function removeUiLayer(): void {
  document.querySelector("#game-ui")?.remove();
}
