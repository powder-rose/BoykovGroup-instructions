import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  fileURLToPath
} from "node:url";


const __dirname =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );


const repositoryRoot =
  path.resolve(
    __dirname,
    "../.."
  );


test(
  "Docker runs Node directly as the container process",
  () => {

    const dockerfile =
      fs.readFileSync(
        path.join(
          repositoryRoot,
          "server",
          "Dockerfile"
        ),
        "utf8"
      );


    assert.match(
      dockerfile,
      /CMD\s+\["node",\s*"src\/index\.js"\]/
    );


    assert.doesNotMatch(
      dockerfile,
      /CMD\s+\["npm",\s*"start"\]/
    );

  }
);


test(
  "production Compose gives API enough time for graceful shutdown",
  () => {

    const compose =
      fs.readFileSync(
        path.join(
          repositoryRoot,
          "deploy",
          "docker-compose.production.yml"
        ),
        "utf8"
      );


    const apiSection =
      compose.match(
        /(?:^|\n)\s{2}api:\s*\n([\s\S]*?)(?=\n\s{2}[A-Za-z0-9_-]+:\s*\n|\nnetworks:\s*\n|$)/
      );


    assert.ok(
      apiSection,
      "API service section not found"
    );


    assert.match(
      apiSection[0],
      /stop_grace_period:\s*20s/
    );

  }
);
