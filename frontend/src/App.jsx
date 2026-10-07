import { useEffect, useState } from "react";
import "./App.css";

function App() {

  const [pc, setPc] = useState(null);
  const [status, setStatus] = useState("Collecting PC information...");

  useEffect(() => {

    fetch("http://localhost:8765/specs")
      .then(response => response.json())
      .then(data => {

        setPc(data);

        return fetch(
          "https://YOUR-DOMAIN.com/save-pc",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
          }
        );

      })
      .then(() => {

        setStatus("PC information saved successfully.");

      })
      .catch(() => {

        setStatus(
          "Unable to connect to the PC agent."
        );

      });

  }, []);


  if (!pc) {

    return (
      <div className="container">

        <h1>PC Information</h1>

        <p>{status}</p>

      </div>
    );

  }


  return (

    <div className="container">

      <h1>PC Information</h1>

      <p className="success">
        {status}
      </p>

      <div className="card">

        <div>
          <strong>PC Name</strong>
          <span>{pc.pc_name}</span>
        </div>

        <div>
          <strong>Username</strong>
          <span>{pc.username}</span>
        </div>

        <div>
          <strong>Windows</strong>
          <span>{pc.windows}</span>
        </div>

        <div>
          <strong>CPU</strong>
          <span>{pc.cpu}</span>
        </div>

        <div>
          <strong>RAM</strong>
          <span>{pc.ram}</span>
        </div>

        <div>
          <strong>GPU</strong>
          <span>{pc.gpu}</span>
        </div>

        <div>
          <strong>Disk</strong>
          <span>{pc.disk}</span>
        </div>

        <div>
          <strong>Manufacturer</strong>
          <span>{pc.manufacturer}</span>
        </div>

        <div>
          <strong>Model</strong>
          <span>{pc.model}</span>
        </div>

        <div>
          <strong>IP Address</strong>
          <span>{pc.ip_address}</span>
        </div>

      </div>

    </div>

  );

}

export default App;