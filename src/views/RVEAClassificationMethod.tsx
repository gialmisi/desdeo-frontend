import React from "react";
import { useEffect, useState, useCallback } from "react";
import {
  ProblemInfo,
  ObjectiveData,
  ObjectiveDatum,
} from "../types/ProblemTypes";
import { Tokens } from "../types/AppTypes";
import ClassificationsInputForm from "../components/ClassificationsInputForm";
import { Container, Row, Col, Button, Form, Table } from "react-bootstrap";
import ReactLoading from "react-loading";
import { ParseSolutions, ToTrueValues } from "../utils/DataHandling";
import { HorizontalBars, ParallelAxes } from "desdeo-components";
import SolutionTable from "../components/SolutionTable";
import SolutionTableMultiSelect from "../components/SolutionTableMultiSelect";
import { Link } from "react-router-dom";

interface RVEAMethodProps {
  isLoggedIn: boolean;
  loggedAs: string;
  tokens: Tokens;
  apiUrl: string;
  methodCreated: boolean;
  activeProblemId: number | null;
}

type Classification = "<" | "<=" | ">=" | "=" | "0";
type RVEAState =
  | "not started"
  | "classification"
  | "archive"
  | "select preferred"
  | "stop";

function RVEAClassificationMethod({
  isLoggedIn,
  loggedAs,
  tokens,
  apiUrl,
  methodCreated,
  activeProblemId,
}: RVEAMethodProps) {
  const [activeProblemInfo, SetActiveProblemInfo] = useState<ProblemInfo>();
  const [methodStarted, SetMethodStarted] = useState<boolean>(false);
  const [helpMessage, SetHelpMessage] = useState<string>(
    "Method not started yet."
  );
  const [preferredPoint, SetPreferredPoint] = useState<number[]>([]);
  const [fetchedInfo, SetFetchedInfo] = useState<boolean>(false);
  const [loading, SetLoading] = useState<boolean>(false);
  const [RVEAState, SetRVEAState] = useState<RVEAState>("not started");
  const [classifications, SetClassifications] = useState<Classification[]>([]);
  const [classificationLevels, SetClassificationLevels] = useState<number[]>(
    []
  );
  const [classificationOk, SetClassificationOk] = useState<boolean>(false);
  const [newSolutions, SetNewSolutions] = useState<ObjectiveData>();
  const [selectedIndices, SetSelectedIndices] = useState<number[]>([]);

  const [cont, SetCont] = useState<boolean>(true);
  const [finalVariables, SetFinalVariables] = useState<number[]>([]);

  // fetch current problem info
  useEffect(() => {
    if (!methodCreated) {
      // method not defined yet, do nothing
      console.log("useEffect: method not defined");
      return;
    }
    if (activeProblemId === null) {
      // no active problem, do nothing
      console.log("useEffect: active problem is null");
      return;
    }

    const fetchProblemInfo = async () => {
      try {
        const res = await fetch(`${apiUrl}/problem/access`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ problem_id: activeProblemId }),
        });

        if (res.status == 200) {
          // ok!
          const body = await res.json();
          SetActiveProblemInfo({
            problemId: body.problem_id,
            problemName: body.problem_name,
            problemType: body.problem_type,
            objectiveNames: body.objective_names,
            variableNames: body.variable_names,
            nObjectives: body.n_objectives,
            ideal: body.ideal,
            nadir: body.nadir,
            minimize: body.minimize,
          });
          SetClassifications(body.objective_names.map(() => "="));
          SetClassificationLevels(body.objective_names.map(() => 0.0));
          SetFetchedInfo(true);
        } else {
          //some other code
          console.log(`could not fetch problem, got status code ${res.status}`);
        }
      } catch (e) {
        console.log("not ok");
        console.log(e);
        // do nothing
      }
    };

    fetchProblemInfo();
  }, []);

  // start the method
  useEffect(() => {
    if (activeProblemInfo === undefined) {
      // no active problem, do nothing
      console.log("Active problem not defined yet.");
      return;
    }

    if (methodStarted) {
      // method already started, do nothing
      return;
    }
    // start the method
    const startMethod = async () => {
      try {
        const res = await fetch(`${apiUrl}/method/control`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
          },
        });

        if (res.status == 200) {
          const body = await res.json();
          SetMethodStarted(true);
          SetNewSolutions(ParseSolutions(body.objectives, activeProblemInfo!));
          SetHelpMessage(
            "Select the solutions you would like to be saved for later viewing."
          );
          SetRVEAState("archive");
        }
      } catch (e) {
        console.log("not ok, could not start the method");
        console.log(`${e}`);
      }
    };

    startMethod();
  }, [activeProblemInfo, methodStarted]);

  const iterate = async () => {
    // Attempt to iterate
    SetLoading(true);

    switch (RVEAState) {
      case "classification": {
        if (!classificationOk) {
          // classification not ok, do nothing
          SetHelpMessage(
            "Check the given classifications. Something must be allowed to improve and something must be allowed to worsen."
          );
          break;
        }
        try {
          console.log(`iterating with levels ${classificationLevels}`);
          const res = await fetch(`${apiUrl}/method/control`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokens.access}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              response: {
                classifications: classifications,
                levels: classificationLevels,
                current_solution: preferredPoint,
                preference_type: 5,
                stage: "classification",
              },
              preference_type: 5,
            }),
          });

          if (res.status === 200) {
            // ok
            const body = await res.json();
            SetNewSolutions(
              ParseSolutions(body.objectives, activeProblemInfo!)
            );
            SetHelpMessage(
              "Select the solutions you would like to be saved for later viewing."
            );
            SetRVEAState("archive");
            break;
          } else {
            // not ok
            console.log(`Got response code ${res.status}`);
            // do nothing
            break;
          }
        } catch (e) {
          console.log("Could not iterate RVEA");
          console.log(e);
          // do nothing
          break;
        }
      }
      case "archive": {
        try {
          const res = await fetch(`${apiUrl}/method/control`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokens.access}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              response: {
                indices: selectedIndices,
                stage: "archive",
              },
              preference_type: 10,
            }),
          });
          if (res.status === 200) {
            const body = await res.json();
            const response = body.response;
            // update the solutions to be shown
            const toBeShown = ParseSolutions(response, activeProblemInfo!);
            SetNewSolutions(toBeShown);
            console.log(toBeShown);

            // reset the active selection
            SetSelectedIndices([]);

            SetHelpMessage(
              "Please select the solution you prefer the most from the shown solution."
            );
            SetRVEAState("select preferred");
            break;
          } else {
            // not ok
            console.log(`Got response code ${res.status}`);
            // do nothing
            return;
          }
        } catch (e) {
          console.log("Could not iterate RVEA");
          console.log(e);
          // do nothing
          break;
        }
      }
      case "select preferred": {
        if (selectedIndices.length === 0) {
          SetHelpMessage("Please select a preferred solution first.");
          // do nothing;
          break;
        }
        try {
          const res = await fetch(`${apiUrl}/method/control`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokens.access}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              response: {
                index: selectedIndices[0],
                stage: "select",
              },
              preference_type: 10,
            }),
          });

          if (res.status === 200) {
            // Ok
            const body = await res.json();
            const response = body.response;
            console.log(response);
            if (cont) {
              // continue iterating
              SetPreferredPoint([...response]); // avoid aliasing
              SetClassificationLevels(response);
              SetClassifications(response.map(() => "=" as Classification));

              SetSelectedIndices([]);
              SetHelpMessage("Please classify each of the shown objectives.");
              SetRVEAState("classification");
              break;
            } else {
              // stop iterating
              console.log(response);
              SetPreferredPoint(response.objective);
              SetFinalVariables(response.solution);
              SetHelpMessage("Stopped. Showing final solution reached.");
              SetRVEAState("stop");
              break;
            }
          } else {
            // not ok
            console.log(`Got response code ${res.status}`);
            // do nothing
            break;
          }
        } catch (e) {
          console.log("Could not iterate RVEA");
          console.log(e);
          // do nothing
          break;
        }
      }
      default: {
        console.log("Default case");
        break;
      }
    }
    SetLoading(false);
  };

  useEffect(() => {
    if (RVEAState === "select preferred") {
      if (selectedIndices.length === 1 || selectedIndices.length === 0) {
        // do nothing
        return;
      }
      SetSelectedIndices([selectedIndices[1]]);
      return;
    }
  }, [selectedIndices]);

  useEffect(() => {
    if (RVEAState === "not started") {
      // do nothing if not started
      return;
    }
    const improve =
      classifications.includes("<" as Classification) ||
      classifications.includes("<=" as Classification);
    const worsen =
      classifications.includes(">=" as Classification) ||
      classifications.includes("0" as Classification);

    if (!improve) {
      SetHelpMessage(
        "Check classifications: at least one objective should be improved."
      );
      SetClassificationOk(false);
      return;
    } else if (!worsen) {
      SetHelpMessage(
        "Check classifications: at least one objective should be allowed to worsen."
      );
      SetClassificationOk(false);
      return;
    } else {
      SetHelpMessage("Classifications ok!");
      SetClassificationOk(true);
      return;
    }
  }, [classifications]);

  const inferClassifications = (barSelection: number[]) => {
    const isDiff = barSelection.map((v, i) => {
      const res =
        // The preferred point must be in the original scale to be compared with barSelection
        Math.abs(v - preferredPoint[i] * activeProblemInfo!.minimize[i]) < 1e-12
          ? false
          : true;
      return res;
    });
    const levels = classificationLevels;
    const classes = barSelection.map((value, i) => {
      if (!isDiff[i]) {
        // no change, return old classification
        return classifications[i];
      }
      if (activeProblemInfo?.minimize[i] === 1) {
        // minimization
        if (value > preferredPoint[i]) {
          // selected value is greater than currently preferred (worse)
          // Worsen until
          levels[i] = barSelection[i];
          return ">=" as Classification;
        } else if (value < preferredPoint[i]) {
          // selected value is less than currently preferred (better)
          // improve until
          levels[i] = barSelection[i];
          return "<=" as Classification;
        } else {
          // no change, keep as it is
          return classifications[i];
        }
      } else if (activeProblemInfo?.minimize[i] === -1) {
        // maximization
        // levels must be transformed back to original scale, hence the minus signs
        if (value > -1 * preferredPoint[i]) {
          // selected value is greater than currently preferred (better)
          // improve until
          levels[i] = -barSelection[i];
          return "<=" as Classification;
        } else if (value < -1 * preferredPoint[i]) {
          // selected value is less than currently preferred (worse)
          // worsen until
          levels[i] = -barSelection[i];
          return ">=" as Classification;
        } else {
          // no change, keep as it is
          return classifications[i];
        }
      } else {
        // something went wrong, return previous classification
        console.log("Encountered something strange in inferClassifications...");
        return classifications[i];
      }
    });
    SetClassificationLevels(levels);
    SetClassifications(classes);
  };

  if (
    !methodCreated ||
    activeProblemId === null ||
    activeProblemInfo === undefined
  ) {
    return <>Please define a method first.</>;
  }

  return (
    <Container>
      <Row>
        <Col sm={12}>
          <h3>RVEA With Classification PIS</h3>
        </Col>
        <Col sm={2}></Col>
        <Col sm={8}>
          <p>{`Help: ${helpMessage}`}</p>
        </Col>
        <Col sm={2}></Col>
        <Col sm={4}></Col>
        <Col sm={4}>
          {!loading && RVEAState !== "stop" && (
            <Button
              size={"lg"}
              onClick={iterate}
              disabled={
                (RVEAState === "classification" && !classificationOk) ||
                (RVEAState === "select preferred" &&
                  selectedIndices.length !== 1)
              }
            >
              {RVEAState === "classification" && classificationOk && "Iterate"}
              {RVEAState === "classification" &&
                !classificationOk &&
                "Check the classifications"}
              {RVEAState === "archive" && selectedIndices.length > 0 && "Save"}
              {RVEAState === "archive" &&
                selectedIndices.length === 0 &&
                "Continue"}

              {RVEAState === "select preferred" &&
                cont &&
                selectedIndices.length === 1 &&
                "Continue"}
              {RVEAState === "select preferred" &&
                cont &&
                selectedIndices.length !== 1 &&
                "Select a solution first"}
              {RVEAState === "select preferred" &&
                !cont &&
                selectedIndices.length === 1 &&
                "Stop"}
              {RVEAState === "select preferred" &&
                !cont &&
                selectedIndices.length !== 1 &&
                "Select a solution first"}
            </Button>
          )}
          {loading && (
            <Button disabled={true} size={"lg"} variant={"info"}>
              {"Working... "}
              <ReactLoading
                type={"bubbles"}
                color={"#ffffff"}
                className={"loading-icon"}
                height={28}
                width={32}
              />
            </Button>
          )}
        </Col>
        <Col sm={4}></Col>
      </Row>
      {RVEAState === "not started" && <div>Method not started yet</div>}
      {RVEAState === "classification" && (
        <>
          <Row>
            <Col sm={12}>
              <h4 className={"mt-3"}>{"Classification"}</h4>
            </Col>
            <Col sm={4}>
              <Form>
                <Form.Group as={Row}>
                  <Form.Label column sm="12">
                    Desired number of solutions
                  </Form.Label>
                </Form.Group>
              </Form>
              <ClassificationsInputForm
                setClassifications={SetClassifications}
                setClassificationLevels={SetClassificationLevels}
                classifications={classifications}
                classificationLevels={classificationLevels}
                currentPoint={preferredPoint}
                nObjectives={activeProblemInfo.nObjectives}
                objectiveNames={activeProblemInfo.objectiveNames}
                ideal={activeProblemInfo.ideal}
                nadir={activeProblemInfo.nadir}
                directions={activeProblemInfo.minimize}
              />
            </Col>
            <Col sm={8}>
              <div className={"mt-5"}>
                <HorizontalBars
                  objectiveData={ToTrueValues(
                    ParseSolutions([preferredPoint], activeProblemInfo)
                  )}
                  referencePoint={classificationLevels.map((v, i) =>
                    activeProblemInfo.minimize[i] === 1 ? v : -v
                  )}
                  currentPoint={preferredPoint.map((v, i) =>
                    activeProblemInfo.minimize[i] === 1 ? v : -v
                  )}
                  setReferencePoint={inferClassifications} // the reference point is passed in its true form to the callback
                />
              </div>
            </Col>
          </Row>
        </>
      )}
      {RVEAState === "archive" && (
        <>
          <Row>
            <Col sm={12}>
              <h4 className={"mt-3"}>{"New solutions"}</h4>
            </Col>
            <Col sm={6}>
              <SolutionTableMultiSelect
                objectiveData={newSolutions!}
                activeIndices={selectedIndices}
                setIndices={SetSelectedIndices}
                tableTitle={""}
              />
            </Col>
            <Col sm={6}>
              <div className={"mt-1"}>
                <ParallelAxes
                  objectiveData={ToTrueValues(newSolutions!)}
                  selectedIndices={selectedIndices}
                  handleSelection={SetSelectedIndices}
                />
              </div>
            </Col>
          </Row>
        </>
      )}
      {RVEAState === "select preferred" && (
        <>
          <Row>
            <Col sm={12}>
              <h4 className={"mt-3"}>{"Select the most preferred solution"}</h4>
            </Col>
            <Col sm={6}>
              <Form>
                <Form.Group as={Row}>
                  <Form.Label column sm={8}>
                    {
                      "Would you like to continue to classification of the selected solution's objectives or to stop?"
                    }
                  </Form.Label>
                  <Col sm={3}>
                    <Form.Check
                      className={"mt-3"}
                      id="stop-switch"
                      type="switch"
                      label={
                        cont ? (
                          <>
                            {"stop/"}
                            <b>{"continue"}</b>
                          </>
                        ) : (
                          <>
                            <b>{"stop"}</b>
                            {"/continue"}
                          </>
                        )
                      }
                      checked={cont}
                      onChange={() => SetCont(!cont)}
                    ></Form.Check>
                  </Col>
                </Form.Group>
              </Form>
              <SolutionTableMultiSelect
                objectiveData={newSolutions!}
                activeIndices={selectedIndices}
                setIndices={SetSelectedIndices}
                tableTitle={"Solutions"}
              />
            </Col>
            <Col sm={6}>
              <div className={"mt-1"}>
                <ParallelAxes
                  objectiveData={ToTrueValues(newSolutions!)}
                  selectedIndices={selectedIndices}
                  handleSelection={SetSelectedIndices}
                />
              </div>
            </Col>
          </Row>
        </>
      )}
      {RVEAState === "stop" && (
        <>
          <SolutionTable
            objectiveData={ParseSolutions([preferredPoint], activeProblemInfo)}
            setIndex={() => console.log("nothing happens...")}
            selectedIndex={0}
            tableTitle={"Final objective values"}
          />
          <p>{"Final decision variable values:"}</p>
          <Table striped bordered hover>
            <thead>
              <tr>
                {finalVariables.map((_, i) => {
                  return <th>{`x${i + 1}`}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {finalVariables.map((v) => {
                  return <td>{`${v.toFixed(4)}`}</td>;
                })}
              </tr>
            </tbody>
          </Table>
          <Button variant="link" href="/">
            {"Back to index"}
          </Button>
        </>
      )}
    </Container>
  );
}

export default RVEAClassificationMethod;
