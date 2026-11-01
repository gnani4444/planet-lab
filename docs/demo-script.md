# Planet Lab · 60–90 second demo

Use [the live lab](https://planet-lab-drab.vercel.app). No sign-in is required. Ask calls the server's OpenAI key directly; Supabase is only used for optional saved recipes.

## Before recording

- Start with the default Mars rover setup.
- Confirm Ask reports available. Run Mars and its matched Earth comparison before asking about measured differences.
- Use live measurements and a real response; do not substitute example numbers.

## Run of show

**0:00–0:10 — The question.** “What changes when the same experiment happens on another world? Planet Lab lets us keep the setup fixed, change the world, and measure the difference.”

**0:10–0:25 — The experiment.** Show the Mars rover launch and its speed and angle controls. Run it. Point to the measured trajectory and result values.

**0:25–0:42 — Same recipe, new world.** Turn on the Earth comparison. Show that the inputs stay the same while the two measured trajectories and results diverge under different gravity and atmosphere.

**0:42–1:05 — OpenAI in the loop.** Click **Explain this result**, then **Why is it different from Earth?** Read the answer in the expanded chat and point to the measured values. Ask a short follow-up. Close the chat, then use **Try Moon rover** to review a concrete setup proposal before clicking **Apply setup**.

**1:05–1:20 — How it stays grounded.** “The browser runs the physics. OpenAI interprets a request and proposes a validated action; it does not run the simulation. Explanations use measured summaries, and cross-world numbers require a matching Earth run.”

**1:20–1:30 — What we built.** “We built the simulator, six activities and six world presets today. Codex helped by splitting work across three GPT-6 Luna agents, defining the shared contracts, then integrating and checking the physics and service boundaries.”

## If a provider request fails during the demo

Use the visible retry action. If the service remains unavailable, continue with the working physics and explain the failure plainly. Do not present a canned response as live OpenAI output.
