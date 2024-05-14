import React from "react";

import { useForm } from "react-hook-form";
import { useState } from "react";

import { Tokens } from "../types/AppTypes";

import { Container, Button, Form } from "react-bootstrap";
import { useDropzone } from "react-dropzone";
import { useCallback } from "react";
import parse from "csv-parse";
import Dropzone from "react-dropzone";

interface ProblemDefinitionProps {
  isLoggedIn: boolean;
  loggedAs: string;
  tokens: Tokens;
  apiUrl: string;
}

interface ProblemData {
  problem_type: string;
  name: string;
  objective_functions: string[];
  objective_names: string[];
  variables: string[];
  variable_initial_values: number[];
  variable_bounds: number[][];
  variable_names: string[];
  ideal: number[];
  nadir: number[];
  minimize: number[];
}

interface DiscreteProblemData {
  problem_type: string;
  name: string;
  objectives: number[][];
  objective_names: string[];
  variables: number[][];
  variable_names: string[];
  minimize: number[];
}

interface ProblemNameAndType {
  name: string;
  type: string;
}

function ProblemDefinition({
  isLoggedIn,
  loggedAs,
  tokens,
  apiUrl,
}: ProblemDefinitionProps) {
  const [problemDefined, SetProblemDefined] = useState<boolean>(false);
  const [problemNameAndType, SetProblemNameAndType] =
    useState<ProblemNameAndType>({ name: "", type: "" });
  const { register, handleSubmit, errors } = useForm<ProblemData>();
  const [message, SetMessage] = useState<string>("");
  const [discreteData, SetDiscreteData] = useState<DiscreteProblemData>({
    problem_type: "",
    name: "",
    objectives: [[]],
    objective_names: [],
    variables: [[]],
    variable_names: [],
    minimize: [],
  });
  const [discreteProblemLoaded, SetDiscretePoblemLoaded] =
    useState<boolean>(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]; // only single files are handled
      const name = file.name;
      const reader = new FileReader();

      reader.onabort = () => console.log("file reading was aborted");
      reader.onerror = () => console.log("file reading has failed");
      reader.onload = () => {
        const textStr = reader.result as string;
        parse(
          textStr,
          { comment: "#", trim: true, skipEmptyLines: true },
          (err, output) => {
            if (err != undefined) {
              SetMessage(`Error parsing csv file: ${err.message}`);
              return;
            } else {
              // Output should contain at least 3 rows
              if (output.length < 3) {
                SetMessage(
                  "The csv data should contain at least three rows. Less than three rows provided."
                );
                return;
              }
              try {
                // First row should be names
                const names = output[0];
                // Second row directions: 'min' or 'max' for objectives, 'var' for variables
                const objOrVar = output[1];
                const nObjectives = objOrVar.filter(
                  (x: string) =>
                    x.toLowerCase() === "min" || x.toLowerCase() === "max"
                ).length;
                const nVars = objOrVar.filter(
                  (x: string) => x.toLowerCase() === "var"
                ).length;
                // Check for proper number of symbols on second row
                if (nObjectives + nVars !== objOrVar.length) {
                  SetMessage(
                    "The second row in the csv file contains unsupported symbols. Supported symbols are 'min', 'max', and 'var'."
                  );
                  return;
                }
                // Get directions: 1 == minimize, -1 == maximize
                const directions = objOrVar
                  .slice(0, nObjectives)
                  .map((x: string) => (x === "min" ? 1 : -1));
                const objNames = names.slice(0, nObjectives);
                const varNames = names.slice(nObjectives);

                // Rest should be the data
                const data = output.slice(2);
                // When parsing the objectives, also check the direction and convert maximization objectives to minimization by multiplying
                // them with -1.
                const objData = data.map((x: string[]) =>
                  x
                    .slice(0, nObjectives)
                    .map((y: string, i) =>
                      directions[i] === 1 ? parseFloat(y) : -1.0 * parseFloat(y)
                    )
                );
                const varData = data.map((x: string[]) =>
                  x.slice(nObjectives).map((y: string) => parseFloat(y))
                );

                // Set the data
                const problemData: DiscreteProblemData = {
                  problem_type: "Discrete",
                  name: name,
                  objectives: objData,
                  objective_names: objNames,
                  variables: varData,
                  variable_names: varNames,
                  minimize: directions,
                };

                SetDiscreteData(problemData);
                SetDiscretePoblemLoaded(true);
                return;
              } catch (err) {
                SetMessage("Something went wrong when parsing the csv file.");
                return;
              }
            }
          }
        );
      };
      reader.readAsText(file);
    },
    [SetMessage, SetDiscreteData, SetDiscretePoblemLoaded]
  );

  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    accept: ".csv",
    maxFiles: 1,
    onDropRejected: (fileRejection, event) => alert("File not accepted!"),
    onDrop: onDrop,
  });

  if (!isLoggedIn) {
    return (
      <Container>
        <p>You are not logged in. Please login first.</p>
      </Container>
    );
  }

  const dummyProblem: ProblemData = {
    problem_type: "Analytical",
    name: "River pollution problem (correct)",
    objective_functions: [
      "-4.07 - 2.27*x",
      "-2.60 - 0.03*x - 0.02*y - 0.01/(1.39 - x**2) - 0.30/(1.39 + y**2)",
      "-8.21 + 0.71 / (1.09 - x**2)",
      "-0.96 - 0.96/(1.09 - y**2)",
    ],
    objective_names: ["WQ City", "WQ Border", "ROI City", "Tax City"],
    variables: ["x", "y"],
    variable_initial_values: [0.5, 0.5],
    variable_bounds: [
      [0.3, 1.0],
      [0.3, 1.0],
    ],
    variable_names: ["x_1", "x_2"],
    ideal: [-6.339, -2.864, -7.499, -11.626],
    nadir: [-4.751, -2.767, -0.321, -1.92],
    minimize: [1, 1, 1, 1],
  };

  const dummyPISProblem: ProblemData = {
    problem_type: "Classification PIS",
    name: "River pollution problem (PIS formulation)",
    objective_functions: [
      "-4.07 - 2.27*x",
      "-2.60 - 0.03*x - 0.02*y - 0.01/(1.39 - x**2) - 0.30/(1.39 + y**2)",
      "-8.21 + 0.71 / (1.09 - x**2)",
      "-0.96 - 0.96/(1.09 - y**2)",
    ],
    objective_names: ["WQ City", "WQ Border", "ROI City", "Tax City"],
    variables: ["x", "y"],
    variable_initial_values: [0.5, 0.5],
    variable_bounds: [
      [0.3, 1.0],
      [0.3, 1.0],
    ],
    variable_names: ["x_1", "x_2"],
    ideal: [-6.339, -2.864, -7.499, -11.626],
    nadir: [-4.751, -2.767, -0.321, -1.92],
    minimize: [1, 1, 1, 1],
  };

  const onSubmit = async (data: ProblemData | DiscreteProblemData) => {
    console.log(typeof data);

    function isDiscreteProblemData(
      data: ProblemData | DiscreteProblemData
    ): data is ProblemData {
      return (data as DiscreteProblemData).objectives !== undefined;
    }

    if (!isDiscreteProblemData(data)) {
      data = dummyProblem;
    }

    try {
      const res = await fetch(`${apiUrl}/problem/create`, {
        method: "POST",
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify(data),
      });
      if (res.status == 201) {
        //status ok
        const body = await res.json();
        SetProblemNameAndType({ name: body.name, type: body.problem_type });
        SetProblemDefined(true);
      }
    } catch (e) {
      console.log("not ok");
      console.log(e);
      // do nothing
    }
  };

  const onSubmitPIS = async (data: ProblemData) => {
    console.log(JSON.stringify(dummyPISProblem));

    try {
      const res = await fetch(`${apiUrl}/problem/create`, {
        method: "POST",
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify(dummyPISProblem),
      });
      if (res.status == 201) {
        //status ok
        const body = await res.json();
        SetProblemNameAndType({ name: body.name, type: body.problem_type });
        SetProblemDefined(true);
      }
    } catch (e) {
      console.log("not ok");
      console.log(e);
      // do nothing
    }
  };

  return (
    <>
      <p>{`${message}`}</p>
      {!problemDefined && (
        <Container>
          <Form action="" onSubmit={handleSubmit(onSubmit)}>
            <Button type="submit">Define dummy problem</Button>
          </Form>
          <Form action="" onSubmit={handleSubmit(onSubmitPIS)}>
            <Button type="submit">Define dummy PIS problem</Button>
          </Form>
          <section className="container border border-dark mt-2 rounded-pill">
            <div {...getRootProps()} className="align-middle">
              <input {...getInputProps()} />
              <p>
                Drag 'n' drop files here, or click to select files to define a
                discrete problem
              </p>
            </div>
          </section>
          {discreteProblemLoaded && (
            <>
              <p>Discrete problem loaded!</p>
              <Button
                onClick={() => {
                  onSubmit(discreteData);
                }}
              >
                Send
              </Button>
            </>
          )}
        </Container>
      )}
      {problemDefined && (
        <Container>
          <p>{`Problem '${problemNameAndType.name}' of type '${problemNameAndType.type}' successfully defined!`}</p>
          <Button
            onClick={() => {
              SetProblemDefined(false);
              SetDiscretePoblemLoaded(false);
            }}
          >
            Define a new problem
          </Button>
        </Container>
      )}
    </>
  );
}

export default ProblemDefinition;
