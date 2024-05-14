import { useEffect, useState } from "react";
import {
  ProblemInfo,
  ObjectiveData,
  ObjectiveDatum,
} from "../types/ProblemTypes";
import { Tokens } from "../types/AppTypes";
import ReferencePointInputForm from "../components/ReferencePointInputForm";
import { Table, Container, Row, Col, Button, Form } from "react-bootstrap";
import ReactLoading from "react-loading";
import { ParseSolutions, ToTrueValues } from "../utils/DataHandling";
import { HorizontalBars, ParallelAxes } from "desdeo-components";
import SolutionTable from "../components/SolutionTable";

interface ReferencePointMethodProps {
  isLoggedIn: boolean;
  loggedAs: string;
  tokens: Tokens;
  apiUrl: string;
  methodCreated: boolean;
  activeProblemId: number | null;
}

function ReferencePointMethod({
  isLoggedIn,
  loggedAs,
  tokens,
  apiUrl,
  methodCreated,
  activeProblemId,
}: ReferencePointMethodProps) {
  const [activeProblemInfo, SetActiveProblemInfo] = useState<ProblemInfo>();
  const [methodStarted, SetMethodStarted] = useState<boolean>(false);
  const [data, SetData] = useState<ObjectiveData>();
  const [helpMessage, SetHelpMessage] = useState<string>(
    "Method not started yet."
  );
  const [referencePoint, SetReferencePoint] = useState<number[]>([]);
  const [currentPoint, SetCurrentPoint] = useState<number[]>([]);
  const [fetchedInfo, SetFetchedInfo] = useState<boolean>(false);
  const [loading, SetLoading] = useState<boolean>(false);
  const [alternatives, SetAlternatives] = useState<ObjectiveData>();
  const [indexCurrentPoint, SetIndexCurrentPoint] = useState<number>(0);
  const [satisfied, SetSatisfied] = useState<boolean>(false);
  const [showFinal, SetShowFinal] = useState<boolean>(false);
  const [finalObjectives, SetFinalObjectives] = useState<number[]>([]);
  const [finalVariables, SetFinalVariables] = useState<number[]>([]);

  useEffect(() => {
    if (alternatives !== undefined) {
      SetCurrentPoint(alternatives.values[indexCurrentPoint].value);
    }
  }, [indexCurrentPoint]);

  useEffect(() => {
    if (alternatives === undefined) {
      SetHelpMessage(
        `Provide a reference point. The current reference point is [${referencePoint.map(
          (v, i) =>
            activeProblemInfo?.minimize[i] === 1 ? v.toFixed(3) : -v.toFixed(3)
        )}]`
      );
    } else if (!satisfied) {
      SetHelpMessage(
        `Provide a new reference point or select a final solution and stop. The current reference point is [${referencePoint.map(
          (v, i) =>
            activeProblemInfo?.minimize[i] === 1 ? v.toFixed(3) : -v.toFixed(3)
        )}]`
      );
    } else {
      SetHelpMessage(
        `Final solution is set to [${referencePoint.map((v, i) =>
          activeProblemInfo?.minimize[i] === 1 ? v.toFixed(3) : -v.toFixed(3)
        )}]. If you are happy with the solution, click on 'stop'`
      );
    }
  }, [referencePoint, alternatives, satisfied, activeProblemInfo]);

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
          SetReferencePoint(body.ideal);
          SetCurrentPoint(body.ideal);
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

          // To begin, just show something neutral
          const datum: ObjectiveDatum = {
            selected: false,
            value: activeProblemInfo.minimize.map((_, i) => {
              return (
                (activeProblemInfo.nadir[i] + activeProblemInfo.ideal[i]) / 2
              );
            }),
          };
          const data: ObjectiveData = {
            values: [datum],
            names: activeProblemInfo.objectiveNames,
            directions: activeProblemInfo.minimize,
            ideal: activeProblemInfo.ideal,
            nadir: activeProblemInfo.nadir,
          };

          SetData(data);
          SetMethodStarted(true);
          SetReferencePoint(datum.value);
          SetHelpMessage(
            `Provide a reference point. The current reference point is [${datum.value.map(
              (v) => v.toFixed(3)
            )}]`
          );
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
    console.log("loading...");
    if (!satisfied) {
      try {
        console.log(`Trying to iterate with ${referencePoint}`);
        const res = await fetch(`${apiUrl}/method/control`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response: { reference_point: referencePoint },
          }),
        });

        if (res.status === 200) {
          // ok
          const body = await res.json();
          const response = body.response;
          SetHelpMessage(response.message);
          SetReferencePoint(response.current_solution);
          SetCurrentPoint(response.current_solution);
          SetAlternatives(
            ParseSolutions(
              [response.current_solution].concat(response.additional_solutions),
              activeProblemInfo!
            )
          );
          console.log(response.additional_solutions);
        } else {
          console.log("Got a response which is not 200");
        }
      } catch (e) {
        console.log("Could not iterate RFP");
        console.log(e);
        // do nothing
      }
    } else {
      try {
        const res = await fetch(`${apiUrl}/method/control`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response: { satisfied: true, solution_index: indexCurrentPoint },
          }),
        });

        if (res.status === 200) {
          // ok
          const body = await res.json();
          const response = body.response;
          SetFinalObjectives(response.objective_vector);
          SetFinalVariables(response.solution);
          SetShowFinal(true);
        } else {
          console.log("Got a response which is not 200");
        }
      } catch (e) {
        console.log("Could not iterate RFP");
        console.log(e);
        // do nothing
      }
    }
    SetLoading(false);
    console.log("done!");
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
      <h3 className="mb-3">{"Reference point method"}</h3>
      {!showFinal && (
        <>
          <p>{`Help: ${helpMessage}`}</p>
          <Row>
            <Col sm={4}></Col>
            <Col sm={4}>
              {!loading && !satisfied && (
                <Button size={"lg"} onClick={iterate}>
                  Iterate
                </Button>
              )}
              {!loading && satisfied && (
                <Button size={"lg"} onClick={iterate}>
                  Stop
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
          <Row>
            <Col sm={2}></Col>
            <Col>
              <h4 className="mt-3">
                Currently selected solution and reference point
              </h4>
            </Col>
            <Col sm={2}></Col>
          </Row>
          <Row>
            <Col sm={4}>
              {fetchedInfo && (
                <>
                  <Form>
                    <Form.Group as={Row}>
                      <Form.Label column sm={8}>
                        {
                          "Are you satisfied with the currently selected solution?"
                        }
                      </Form.Label>
                      <Col sm={3}>
                        <Form.Check
                          className={"mt-3"}
                          id="satisfied-switch"
                          type="switch"
                          disabled={alternatives === undefined ? true : false}
                          label={
                            satisfied ? (
                              <>
                                {"no/"}
                                <b>{"yes"}</b>
                              </>
                            ) : (
                              <>
                                <b>{"no"}</b>
                                {"/yes"}
                              </>
                            )
                          }
                          checked={satisfied}
                          onChange={() => SetSatisfied(!satisfied)}
                        />
                      </Col>
                    </Form.Group>
                  </Form>
                  <ReferencePointInputForm
                    setReferencePoint={SetReferencePoint}
                    referencePoint={referencePoint}
                    nObjectives={activeProblemInfo.nObjectives}
                    objectiveNames={activeProblemInfo.objectiveNames}
                    ideal={activeProblemInfo.ideal}
                    nadir={activeProblemInfo.nadir}
                    directions={activeProblemInfo.minimize}
                  />
                </>
              )}
            </Col>
            <Col sm={8}>
              {fetchedInfo && (
                <div className={"mt-5"}>
                  <HorizontalBars
                    objectiveData={ToTrueValues(
                      ParseSolutions([referencePoint], activeProblemInfo)
                    )}
                    referencePoint={referencePoint.map((v, i) =>
                      activeProblemInfo.minimize[i] === 1 ? v : -v
                    )}
                    currentPoint={currentPoint.map((v, i) =>
                      activeProblemInfo.minimize[i] === 1 ? v : -v
                    )}
                    setReferencePoint={(ref: number[]) =>
                      SetReferencePoint(
                        ref.map((v, i) =>
                          activeProblemInfo.minimize[i] === 1 ? v : -v
                        )
                      )
                    }
                  />
                </div>
              )}
            </Col>
          </Row>
          {!(alternatives === undefined) && (
            <>
              <Row>
                <Col sm={2}></Col>
                <Col>
                  <h4 className="mt-3">Alternative solutions</h4>
                </Col>
                <Col sm={2}></Col>
              </Row>
              <Row>
                <Col sm={6}>
                  <div className={"mt-2"}>
                    <SolutionTable
                      objectiveData={alternatives!}
                      setIndex={SetIndexCurrentPoint}
                      selectedIndex={indexCurrentPoint}
                      tableTitle={""}
                    />
                  </div>
                </Col>
                <Col sm={6}>
                  <div className={"mt-3"}>
                    <ParallelAxes
                      objectiveData={ToTrueValues(alternatives!)}
                      selectedIndices={[indexCurrentPoint]}
                      handleSelection={(x: number[]) => {
                        x.length > 0
                          ? SetIndexCurrentPoint(x.pop()!)
                          : SetIndexCurrentPoint(indexCurrentPoint);
                      }}
                    />
                  </div>
                </Col>
              </Row>
            </>
          )}
        </>
      )}
      {showFinal && (
        <>
          <SolutionTable
            objectiveData={ParseSolutions([finalObjectives], activeProblemInfo)}
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

export default ReferencePointMethod;
