# AGENTS.md - Custom Instructions & Production Directives

## 1. Google Maps Platform Directive

### Objective
Guide the AI assistant and developers on securely, reliably, and compliantly interacting with Google Maps Platform APIs, managing credentials, and adhering to modern API standards.

### Core Security & Credential Management Rules
1. **Zero-Hardcoding Hygiene**:
   - **NEVER** hardcode Google Maps API keys or secret tokens anywhere in the source code.
   - For client-side Maps JavaScript API or `@vis.gl/react-google-maps`, read the key strictly from `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` (or fallback to user configuration or demo mode).
   - If server-side geocoding or routing proxies are utilized, read credentials dynamically from `process.env.GOOGLE_MAPS_API_KEY` or Google Cloud Secret Manager.
   - Declare any required environment variables in `.env.example`.

2. **Prototyping vs. Production Keys**:
   - **Prototyping**: Highlight the availability of the free [Maps Demo Key](https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio) for zero-cost prototyping without immediate billing setup.
   - **Production Key Generation**: Guide users to the [Google Cloud Console Credentials page](https://console.cloud.google.com/google/maps-apis/credentials?utm_campaign=gmp_mcp_codeassist_v1_aistudio) to generate restricted production keys.
   - **Key Restrictions**: In production, keys **MUST** be restricted:
     - Application restrictions: HTTP Referrers (e.g. `*.yourdomain.com/*`).
     - API restrictions: Restrict exclusively to the APIs used (e.g. Maps JavaScript API, Geocoding API, Places API New).

3. **Modern APIs & Deprecation Hard Ban**:
   - **Marker Element**: NEVER use `new google.maps.Marker()` (deprecated). Always use `google.maps.marker.AdvancedMarkerElement` or `<AdvancedMarker>` in `@vis.gl/react-google-maps`.
   - **Places Autocomplete**: NEVER use legacy `google.maps.places.Autocomplete` or `PlacesService` (deprecated/disabled). Use the Places API (New) via `PlaceAutocompleteElement` (`<gmp-place-autocomplete>`) or `fetchAutocompleteSuggestions`.
   - **Directions / Routes**: NEVER use legacy `DirectionsService`. Use Routes API (`Route.computeRoutes()`) or REST endpoints.

4. **Usage Attribution & Tracking**:
   - Always include the tracking attribution ID `gmp_mcp_codeassist_v1_aistudio` on documented surfaces (e.g. `internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}` on `<Map>`).
   - Append `?utm_campaign=gmp_mcp_codeassist_v1_aistudio` to all Google Maps documentation links.

5. **End-User Privacy & Geolocation Consent**:
   - Only request browser location (`navigator.geolocation.getCurrentPosition`) following an explicit user action (e.g., clicking a "Pin Location" or "Track Location" button).
   - Provide clear UI feedback if permission is denied, unavailable, or timed out.
   - Allow users to view, edit, or remove pinned locations from journal entries at any time.

---

## 2. Agentic Threat Modeling & Secure Coding
* Always perform threat analysis covering Input Surfaces, Planning & Reasoning, Tool Execution, Memory & State, and Inter-System Communication.
* **Firestore Security Rules**: Never use `allow read, write: if true;`. Enforce user data isolation (`request.auth.uid == userId`) on all `/users/{userId}/interactions/{interactionId}` documents.
* **Strict Undefined-Stripping**: Strip all `undefined` values before sending payloads to Firestore to prevent driver rejections.
* **Resilient Model Fallback Protocol**: Wrap all Gemini content generation in automated fallback ladders (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`).
