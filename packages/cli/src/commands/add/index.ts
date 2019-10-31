import chalk from "chalk";
import path from "path";
import fs from "fs-extra";

import * as cli from "../../utils/cli";
import * as git from "@changesets/git";
import { info, log, warn } from "@changesets/logger";
import { Config } from "@changesets/types";

import writeChangeset from "./writeChangeset";
import createChangeset from "./createChangeset";
import getChangesetBase from "../../utils/getChangesetBase";
import printConfirmationMessage from "./messages";

export default async function add(
  cwd: string,
  { empty }: { empty?: boolean },
  config: Config
) {
  const changesetBase = await getChangesetBase(cwd);

  if (!fs.existsSync(changesetBase)) {
    warn("There is no .changeset folder. ");
    warn(
      "If this is the first time `changesets` have been used in this project, run `yarn changeset init` to get set up."
    );
    warn(
      "If you expected there to be changesets, you should check git history for when the folder was removed to ensure you do not lose any configuration."
    );
    return;
  }

  let newChangeset, confirmChangeset;
  if (empty) {
    newChangeset = {
      releases: [],
      summary: ``
    };
    confirmChangeset = true;
  } else {
    const changedPackages = await git.getChangedPackagesSinceMaster(cwd);
    const changePackagesName = changedPackages
      .filter(a => a)
      .map(pkg => pkg.name);
    newChangeset = await createChangeset(changePackagesName, cwd);
    printConfirmationMessage(newChangeset);

    confirmChangeset = await cli.askConfirm("Is this your desired changeset?");
  }

  if (confirmChangeset) {
    const changesetID = await writeChangeset(newChangeset, cwd);
    if (config.commit) {
      await git.add(path.resolve(changesetBase, `${changesetID}.md`), cwd);
      await git.commit(
        `CHANGESET: ${changesetID}. ${newChangeset.summary}`,
        cwd
      );
      log(chalk.green(`${empty ? "Empty " : ""}Changeset added and committed`));
    } else {
      log(
        chalk.green(
          `${empty ? "Empty " : ""}Changeset added! - you can now commit it\n`
        )
      );
    }

    let hasMajorChange = [...newChangeset.releases].find(
      c => c.type === "major"
    );

    if (hasMajorChange) {
      warn(
        "This Changeset includes a major change and we STRONGLY recommend adding more information to the changeset:"
      );
      warn("WHAT the breaking change is");
      warn("WHY the change was made");
      warn("HOW a consumer should update their code");
    } else {
      log(
        chalk.green(
          "If you want to modify or expand on the changeset summary, you can find it here"
        )
      );
    }
    info(chalk.blue(path.resolve(changesetBase, `${changesetID}.md`)));
  }
}