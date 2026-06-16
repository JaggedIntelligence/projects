# How to convert HTML static page into a React JS page

### How to  a  Viewable HTML with Github preview

step 0: one should (SR or anybody), test a .html page ( inpsect of a random webpage )
 - get the inspect view source to text file
 - chnage all .css and .js references to full domain name , so links won't break
 - then save it as .html file  in Gist of Github account

step 1 : create a .html file in Gist ( same github account)
https://gist.github.com/JaggedIntelligence/fcf27ac1dabb533c498c4cf2bcefe54d

step 2: view it as html file ; just change the document ID after ? ; voila .. 
https://gistpreview.github.io/?fcf27ac1dabb533c498c4cf2bcefe54d


setp 3: once Viewed .html rendered is GOOD, then convert it into ReactJS page with the help of Codex 


## SREDDY Note on How to give sensible Input Starter files to Codex ...
 - I am glad I gave the sample.html a working file **instead of randombly asking for CSS Styles and interaction**.
 - Codex took the input sample.html mentioned in .html file and imported CSS styles selectively instead of whole file
 - for JS files of sample.html, it discarded and implemented the required Drag and Filter functionaly in concepts-docs-interactions.tsx file 
 - this gave GREAT experice for SREDY , how to convert a good working UI/UX html code into React.js .. 
 - the pain and Approach SREDDY took is good, edited the HUGE big file and cut into small sample.html file ( by removing all unnacessariy links etc..) so Codex can understand it easily.

### Codex document is here
  1PROJECT-DOCS/14_html_to_reactjs_port.md