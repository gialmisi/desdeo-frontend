import { useEffect, useState, useCallback } from "react";
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
import {
  HorizontalBars,
  NavigationBars,
  ParallelAxes,
} from "visual-components";
import SolutionTable from "../components/SolutionTable";
import { Link } from "react-router-dom";

// välidata
// Piirtää siis oikein kunhanh data on oikein hyvä juttu

type ProblemData = {
  upperBounds: number[][];
  lowerBounds: number[][];
  referencePoints: number[][];
  boundaries: number[][];
  totalSteps: number;
  stepsTaken: number;
};

/* TODO:
 * varmaan parempi olisi jos menisi navbarseille
 * referencePoints ja boundary omassa propsissa.
 * ei tarvitse piirtää koko dataa uudestaan kun niitä
 * liiikuttaa sitten
 *
 * polygoneille step 0:
 * idealista ja nadirista kun valmistaa..
 *
 */

const emptyData: ProblemData = {
  upperBounds: [
    [-2.32, -2.319], // objective 1
    [-2.5, -2.4], // objective 2
    [-3.8, -3.7], // objective 3
  ],
  lowerBounds: [
    [-2.316, -2.317], // objective 1
    [-1.8, -1.9], // objective 2
    [-1.8, -1.85], // objective 3
  ],
  referencePoints: [
    [-2.318, -2.318], // objective 1
    [-1.9, -2], // objective 2
    [-2.6, -2.7], // objective 3
  ],
  // boundary needs to have set default value or some value for the objective if its not used so the order doenst go wrong
  boundaries: [
    //[Number.NaN], 
    //[Number.NaN],
    [-2.319, -2.319],
    [-2.2, -2.2],
    //[-3.2, -3.5],
    [Number.NaN ]
  ],
  totalSteps: 100,
  stepsTaken: 1, // this must to be stepsTaken - 1 from to the bounds and refereslines given.
};

interface NautilusNavigatorMethodProps {
  isLoggedIn: boolean;
  loggedAs: string;
  tokens: Tokens;
  apiUrl: string;
  methodCreated: boolean;
  activeProblemId: number | null;
  // muuta?
}

function NautilusNavigatorMethod({
  isLoggedIn,
  loggedAs,
  tokens,
  apiUrl,
  methodCreated,
  activeProblemId,
}: NautilusNavigatorMethodProps) {
  const [activeProblemInfo, SetActiveProblemInfo] = useState<ProblemInfo>();
  const [methodStarted, SetMethodStarted] = useState<boolean>(false);
  // this has one data object the currently used
  const [currentData, SetCurrentData] = useState<ProblemData>();
  // this has all of the data saved, and you should send the wanted problemData object of these to the navigator
  const [dataArchive, SetDataArchive] = useState<ProblemData[]>([]);
  const [currentStep, SetCurrentStep] = useState<number>(0); // maybe this to set the currentstep to right one and then pick the correct from dataArchive ?

  // apinoidaan nimbuksen classifications logiikka

  // this would have every problemData unit as a list
  //let dataArchive:ProblemData[] = [];


  const [helpMessage, SetHelpMessage] = useState<string>(
    "Method not started yet."
  );

  // navigaattorille
  const [endNavigating, SetEndNavigating] = useState<boolean>(false); // navigaatio stepit täynnä ja loppu.
  const [stoppedNav, setStoppedNav] = useState<boolean>(true);

  // tämänlaisete mutta refviivoille / boundareille
  const [referencePoint, SetReferencePoint] = useState<number[][]>(
    emptyData.referencePoints
  );
  const [boundaryPoint, SetBoundaryPoint] = useState<number[][]>(
    emptyData.boundaries
  );

  // this could be the new point, just moved. To be added to refpoints.
  const [currentPoint, SetCurrentPoint] = useState<number[]>([]);

  // yleiset
  const [fetchedInfo, SetFetchedInfo] = useState<boolean>(false);
  const [loading, SetLoading] = useState<boolean>(false);

  // ei ehkä navigaattorille, mutta vastaavat voi olla hyvä
  //const [satisfied, SetSatisfied] = useState<boolean>(false);
  const [showFinal, SetShowFinal] = useState<boolean>(false);
  const [alternatives, SetAlternatives] = useState<ObjectiveData>();
  //const [finalObjectives, SetFinalObjectives] = useState<number[]>([]);
  //const [finalVariables, SetFinalVariables] = useState<number[]>([]);

  // ei olleenkaan / en ole varma
  const [indexCurrentPoint, SetIndexCurrentPoint] = useState<number>(0);


  // is coming here really necessary so this starts properly what ?
  const updateDataArchive = (data: ProblemData, ind: number) => {
    console.log("DAtaa on nyt", dataArchive)
    dataArchive[ind] = data;
    console.log("DAtaa on nyt2", dataArchive)
  }


  useEffect(() => {
    console.log(currentData, ' -  has changed')

  }, [currentData])

  // use effectejä vaan
  useEffect(() => {
    if (alternatives !== undefined) {
      SetCurrentPoint(alternatives.values[indexCurrentPoint].value);
    }
  }, [indexCurrentPoint]);

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

    // tarvittava
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
          console.log(body);
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
          //console.log("AcT prob", activeProblemInfo)
          // lisätään navigaattorille oma info täällä
          
          // set data start from ideal and nadir
          // INITIALIZE step 0.
          const ogdata: ProblemData = {
            upperBounds: body.nadir.map((d:number) => {
              return [d]
            }),
            lowerBounds: body.ideal.map((d:number)=>{
              return [d]
            }),
            referencePoints: body.minimize.map((_:any,i:number)=>{
              return [(body.nadir[i] + body.ideal[i])/2]
            }),
            boundaries: [[Number.NaN], [Number.NaN], [Number.NaN]], // convert to these from the coming nulls.
            totalSteps: 100,
            stepsTaken: 0,
          };
          SetCurrentData(ogdata); 
          SetDataArchive([ogdata]) // should be ok ?
          updateDataArchive(ogdata, 0) // apparently we need to call something outside for the method to start properly ?? 

          SetCurrentStep(0);
          //SetDataArchive(ogdata); 
          //SetReferencePoint(body.ideal);
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
          console.log("method data", body);
          // To begin, just show something neutral
          // näytä alkunäkymä missä step 0

          const currdata: ProblemData = {
            upperBounds: body.response.reachable_ub.map((d:number) => {
              return [d]
            }),
            lowerBounds: body.response.reachable_lb.map((d:number)=>{
              return [d]
            }),
            referencePoints: body.response.navigation_point.map((d:number)=>{
              return [d]
            }),
            boundaries: [[Number.NaN], [Number.NaN], [Number.NaN]], // convert to these from the coming nulls.
            totalSteps: body.response.steps_remaining,
            stepsTaken: body.response.step_number,
          };

          console.log("Tämä muoto", currdata);

          // TODO: unite them, make new object which set to the currentdata and add to the archive at correct position.
          // stupid but kinda the right idea. Now just need to add the currentData values to the dataArchive..
          const newArchiveData = {
            upperBounds: currdata.upperBounds.map((d, i) => {
              return dataArchive[0].upperBounds[i].concat(d)
            }),
            lowerBounds: currdata.lowerBounds.map((d, i) => {
              return dataArchive[0].lowerBounds[i].concat(d)
            }),
            referencePoints: currdata.referencePoints.map((d, i) => {
              return dataArchive[0].referencePoints[i].concat(d)
            }),
            boundaries: [[Number.NaN], [Number.NaN], [Number.NaN]], // convert to these from the coming nulls.
            totalSteps: 100,
            stepsTaken: currdata.stepsTaken,
          }

          console.log("toim iko,", newArchiveData)
          SetDataArchive(dataArchive.map(() => dataArchive[0] =  newArchiveData))


          console.log(dataArchive[1])

          SetCurrentData(dataArchive[0]);
          SetCurrentStep(1);
          SetMethodStarted(true);
          SetReferencePoint(newArchiveData.referencePoints); // mites tupla taulukon kanssa, miten toimii nav comp nyt.


          SetFetchedInfo(true);
          SetHelpMessage(
            `Provide a reference point. The current reference point is `
          );
        }
      } catch (e) {
        console.log("not ok, could not start the method");
      }
    };

    startMethod();
  }, [activeProblemInfo, methodStarted]);






  const iterate = async () => {
    // Attempt to iterate
    SetLoading(true);
    console.log("loading...");
    if (stoppedNav) {
      try {
        console.log(`Trying to iterate with ${referencePoint}`);
        const res = await fetch(`${apiUrl}/method/control`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.access}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // oikeanmuotoisena navin tiedot
            response: {
              reference_point: [-2,-2,-2],// TODO: this conversion from number[][] to number[]
              speed: 5,
              go_to_previous: false,
              stop: false,
              user_bounds: [null, null, null],
            },
          }),
        });

        // response
        // palautttaaa vaan ns. yhden uuden "pisteen" eli pitää täällä käyttöliittymässä
        // lisätä johonkin dataobjektin listaan aina se uusi askel ja samalla kopioida ja tehdä siitä uusi että piirtää uudestaan.
        // Ja sitten pitää pystyä pitämään tallessa kaikki arvot, että voi vaan palata aiempaan..
        // Jotain tyyliä NavigationData.. tms
        // Ehkä olisi navigationData jossa kaikki data historioineen piirtämistä varten. Sitten olisi
        // current refpoint ja current Bound josta piirretään ne refpointit ja boundit.. nämä myös olisi navdatassa jos esim palataan.

        if (res.status === 200) {
          // ok
          const body = await res.json();
          const response = body.response;
          // muutokset
          SetHelpMessage(response.message);
          console.log("resp", response);

  
          const newArchiveData: ProblemData = {
            upperBounds: body.response.reachable_ub.map((d:any, i:any) => {
              return dataArchive[0].upperBounds[i].concat(d)
            }),
            lowerBounds: body.response.reachable_lb.map((d:any, i:any) => {
              return dataArchive[0].lowerBounds[i].concat(d)
            }),
            referencePoints: body.response.navigation_point.map((d:any, i:any) => {
              return dataArchive[0].referencePoints[i].concat(d)
            }),
            boundaries: [[Number.NaN], [Number.NaN], [Number.NaN]], // convert to these from the coming nulls.
            totalSteps: 100,
            stepsTaken: body.response.step_number,
          }


          SetDataArchive(dataArchive.map(() => dataArchive[0] = newArchiveData))
          console.log("Iteraatio", dataArchive)
          SetCurrentData(newArchiveData)
          SetReferencePoint(newArchiveData.referencePoints); // mites tupla taulukon kanssa, miten toimii nav comp nyt.
          SetCurrentStep(currentStep + 1)


        } else {
          console.log("Got a response which is not 200");
        }
      } catch (e) {
        console.log("Could not iterate nau navi");
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
          console.log("resp", response);
          //SetFinalObjectives(response.objective_vector);
          //SetFinalVariables(response.solution);
          //SetShowFinal(true);
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
      <h3 className="mb-3">{"Nautilus navigator method"}</h3>
      {!showFinal && (
        <>
          <p>{`Help: ${helpMessage}`}</p>
          <Row>
            <Col sm={4}></Col>
            <Col sm={4}>
              {!loading && stoppedNav && (
                <Button block={true} size={"lg"} onClick={iterate}>
                  Start Navigation
                </Button>
              )}
              {!loading && !stoppedNav && (
                <Button block={true} size={"lg"} onClick={iterate}>
                  Stop
                </Button>
              )}
              {loading && (
                <Button
                  block={true}
                  disabled={true}
                  size={"lg"}
                  variant={"info"}
                >
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
          </Row>
          <Row></Row>
          <Row>
            <Col sm={8}>
              {fetchedInfo && (
                <div className={"mt-5"}>
                  {console.log("ennen piirtoa", dataArchive)}
                  {console.log("ennen piirtoa", currentData)}
                  <NavigationBars
                    problemInfo={activeProblemInfo} // TODO: these correct, its pain
                    problemData={currentData!} // this to have data from back end
                    referencePoints={currentData!.referencePoints} // these to use back end data
                    boundaries={currentData!.boundaries}
                    handleReferencePoint={(ref: number[][]) => {
                      SetReferencePoint(ref);
                    }}
                    handleBound={(bound: number[][]) => {
                      SetBoundaryPoint(bound);
                    }}
                  />
                </div>
              )}
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}

export default NautilusNavigatorMethod;
