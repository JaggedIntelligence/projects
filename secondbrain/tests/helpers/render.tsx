import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import { useTaskStore } from "@/store/task-store";

export function resetTaskStore() {
  useTaskStore.setState(useTaskStore.getInitialState(), true);
}

export function renderComponent(ui: ReactElement) {
  return render(ui);
}
