import React from "react";
import { Tokens } from "../types/AppTypes";
import { Container } from "react-bootstrap";
import { Redirect } from "react-router-dom";

import { useEffect, useState } from "react";

function Logout({
  apiUrl,
  isLoggedIn,
  setIsLoggedIn,
  setLoggedAs,
  tokens,
  setTokens,
}: {
  apiUrl: string;
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  setLoggedAs: React.Dispatch<React.SetStateAction<string>>;
  tokens: Tokens;
  setTokens: React.Dispatch<React.SetStateAction<Tokens>>;
}) {
  const [logoutOk, SetLogoutOk] = useState<boolean>(false);
  const [errMsg, SetErrMsg] = useState<string>("");

  useEffect(() => {
    const handleLogout = async () => {
      try {
        const res_access = await fetch(`${apiUrl}/logout/access`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokens.access}` },
        });
        if (res_access.status != 200) {
          console.log(await res_access.json());
          throw new Error("Could not revoke access token.");
        }
      } catch (err) {
        if (err instanceof Error) {
          SetErrMsg(err.message);
        }
        SetLogoutOk(false);
        return;
      }
      try {
        const res_refresh = await fetch(`${apiUrl}/logout/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokens.refresh}` },
        });

        if (res_refresh.status != 200) {
          throw new Error("Could not revoke refresh token.");
        }
      } catch (err) {
        if (err instanceof Error) {
          SetErrMsg(err.message);
        }
        SetLogoutOk(false);
        return;
      }

      SetLogoutOk(true);
      setTokens({ access: "", refresh: "" });
      setIsLoggedIn(false);
      setLoggedAs("");
    };

    if (!isLoggedIn) {
      // if not logged in, do nothing
      return;
    }

    handleLogout();
  }, []); // this way useEffect runs only once per page load

  if (!isLoggedIn) {
    return (
      <Container>
        You are already logged out.
        <Redirect to="/" />
      </Container>
    );
  }

  return (
    <>
      {logoutOk && (
        <Container>
          {" "}
          Logged out successfully!
          <Redirect to="/" />
        </Container>
      )}
      {!logoutOk && (
        <Container>{`Could not logout. Reason ${errMsg}`}</Container>
      )}
    </>
  );
}

export default Logout;
