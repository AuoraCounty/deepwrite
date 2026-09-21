import type { CreateCreativeBookPayload } from "../components/WorkspaceDialogLayer.types";
import type { CreativeBookCreationOptions } from "./useCreativeBookCreation";
import { withShortBookDefaultPlotStages } from "../utils/shortBookDefaultPlotStages";
export async function submitCreativeBook(
  input: CreateCreativeBookPayload,
  options: CreativeBookCreationOptions
) {
  if (input.workspaceType === "long") {
    const { workspaceType: _workspaceType, ...book } = input;
    await options.createLong(book);
    return;
  }
  await options.createShort(
    input.templateId
      ? input
      : withShortBookDefaultPlotStages(
          input,
          options.settings.value,
          options.catalog.value?.creativePlotStages ?? []
        )
  );
}
