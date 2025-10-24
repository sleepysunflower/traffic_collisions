import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import * as ort from 'onnxruntime-web';
import { asset } from './utils/asset';
ort.env.wasm.wasmPaths = asset('onnx/'); // now loads from /traffic_collisions/onnx/

import Landing from "./Landing";
import App from "./App";
import ModelPage from "./model";
import "./styles.css";
import { registerChartsTheme } from './theme'
// read redirected path on GH Pages fallback
const params = new URLSearchParams(location.search);
const redirected = params.get('p');
if (redirected) {
  const url = new URL(location.href);
  url.searchParams.delete('p');
  history.replaceState(null, '', redirected + url.search + url.hash);
}

registerChartsTheme()
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<App />} />
        {/* IMPORTANT: allow subpaths like /model/occurrence and /model/severity */}
        <Route path="/model/*" element={<ModelPage />} />
        {/* Fallback: go to occurrence */}
        <Route path="*" element={<Navigate to="/model/occurrence" replace />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
