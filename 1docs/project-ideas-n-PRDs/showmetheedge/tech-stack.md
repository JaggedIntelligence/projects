# Tech Stack considerations for Show Me the EDGE

### big picture
- abc ...

### Tech Stack Details

- TODO :
    - get to HERE, the Ascii diagram of the Architeucre from  /showmeedge repo folder ask Codex to genereate 

- 1/ DATA Visualization:
    - Data visualizations is big part of any Finance Applicaiton, ShowMeEdge is no exception.
    - TODO: SR need to articulate the "Perspctive" vs. other Data viz libarires 
    - SR looked at Prespective Package which can facilite  Streaming of HUGE Visualizaion easily
    - SEE teh Details in Prespective is documented in /1docs/1cool-repos-n-techstacks/data-visulizations/perspecitve.md file 
    - in the above the there are **Youtube Walktroughs" of couple of videos of "Perspective" from  PyDATA, DATABricsks and JPMorgan

- 2/ Frontend and Backend server selection
    - for now we are using our Standard Stack 
        - front end server:  "NextJs", Drizzle ORM, Postgres DB, Clerk AUTH 
        - back end server : 
            - **FastAPI Python server** ( to do Backtesting using VectorBT Pro .. SR has subscription paid coz Pro version has good lib functions)
            - **QuestDB** ( coz it can store millions of rows of  1 mintute data of intraday for 1000 of Stick tickers)
    - the repo folder is  /showmeedge
    - Code is genereated by Codex ... SR needs to Test ..
