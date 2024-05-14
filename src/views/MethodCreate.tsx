import React from "react";
import { useState, useEffect } from "react";
import { Tokens } from "../types/AppTypes";
import { Container, Form, Row, Col, Button } from "react-bootstrap";

interface MethodCreateProps {
  isLoggedIn: boolean;
  loggedAs: string;
  tokens: Tokens;
  apiUrl: string;
  setMethodCreated: React.Dispatch<React.SetStateAction<boolean>>;
  setChosenMethod: React.Dispatch<React.SetStateAction<string>>;
  setActiveProblemId: React.Dispatch<React.SetStateAction<number | null>>;
}

interface Problem {
  id: number;
  name: string;
  problem_type: string;
  minimize: number[];
}

function MethodCreate({
  isLoggedIn,
  loggedAs,
  tokens,
  apiUrl,
  setMethodCreated,
  setChosenMethod,
  setActiveProblemId,
}: MethodCreateProps) {
  const [problems, SetProblems] = useState<Problem[]>([
    {
      id: 0,
      name: "placeholder",
      problem_type: "test",
      minimize: [1],
    },
  ]);
  const [problemId, SetProblemId] = useState<number>(1);
  const [methodKey, SetMethodKey] = useState<number>(0);

  useEffect(() => {
    if (!isLoggedIn) {
      // do nothing
      return;
    }
    const fetchProblems = async () => {
      try {
        const res = await fetch(`${apiUrl}/problem/access`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
          },
        });

        if (res.status == 200) {
          const body = await res.json();
          SetProblems(body.problems);
          // problems fetched!
        } else {
          console.log(
            `Got return code ${res.status}. Could not fetch problems.`
          );
          // do nothing
        }
      } catch (e) {
        console.log("not ok");
        console.log(e);
        //do nothing
      }
    };

    fetchProblems();
  }, []);

  const handleSubmit = async () => {
    console.log(`selected: problem ${problemId} method ${methodKey}`);
    try {
      let methodName: string = "";
      switch (methodKey) {
        case 0: {
          methodName = "reference_point_method";
          break;
        }
        case 1: {
          methodName = "synchronous_nimbus";
          break;
        }
        case 2: {
          methodName = "nautilus_navigator";
          break;
        }
        case 3: {
          methodName = "rvea";
          break;
        }
        case 4: {
          methodName = "irvea";
          break;
        }
        case 5: {
          methodName = "iopis";
          break;
        }
        case 6: {
          methodName = "rvea/class";
          break;
        }
        default: {
          throw Error(`Invalid methodKey: ${methodKey}`);
        }
      }

      const data = { problem_id: problemId, method: methodName };
      const res = await fetch(`${apiUrl}/method/create`, {
        method: "POST",
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify(data),
      });

      if (res.status == 201) {
        const body = await res.json();
        console.log(body);
        setMethodCreated(true);
        setActiveProblemId(problemId);
        setChosenMethod(methodName);
        // created!
      } else {
        console.log(`Got return code ${res.status}. Could not create method.`);
        // do nothing
      }
    } catch (e) {
      console.log(e);
      // Do nothing
    }
  };

  if (!isLoggedIn) {
    return (
      <>
        <p>You need to login first before setting up a new method.</p>
      </>
    );
  }

  return (
    <>
      <Container>
        <Row>
          <Col>
            <h2>Create a method</h2>
          </Col>
        </Row>
        <Row>
          <Col>
            <Form action="">
              <Row>
                <Col>
                  <Form.Group>
                    <Form.Label>Select a problem</Form.Label>
                    <Form.Control
                      as="select"
                      defaultValue={0}
                      onChange={(e) => {
                        SetProblemId(parseInt(e.target.value));
                      }}
                    >
                      {problems.map((problem, index) => {
                        return (
                          <option value={problem.id} key={index}>
                            {`${problem.name} (${problem.problem_type})`}
                          </option>
                        );
                      })}
                    </Form.Control>
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group>
                    <Form.Label>Select a method</Form.Label>
                    <Form.Control
                      as="select"
                      defaultValue={0}
                      onChange={(e) => {
                        SetMethodKey(parseInt(e.target.value));
                      }}
                    >
                      <option value={0}>Reference Point Method</option>
                      <option value={1}>Synchronous NIMBUS</option>
                      <option value={2}>Nautilus Navigator</option>
                      <option value={3}>RVEA</option>
                      <option value={4}>iRVEA</option>
                      <option value={5}>IOPIS</option>
                      <option value={6}>RVEA Classification</option>
                    </Form.Control>
                  </Form.Group>
                </Col>
              </Row>
              <Row className="mt-2">
                <Col>
                  <Button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSubmit();
                    }}
                  >
                    Create method
                  </Button>
                </Col>
              </Row>
            </Form>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default MethodCreate;
