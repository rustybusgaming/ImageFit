import UploadZone from "./components/UploadZone";


function App(){

return (

<main
className="
min-h-screen
bg-white
dark:bg-black
text-black
dark:text-white
p-8
"
>

<div
className="
max-w-3xl
mx-auto
"
>


<h1
className="
text-5xl
font-bold
mb-3
"
>
ImageFit
</h1>


<p
className="
opacity-60
mb-10
"
>
Resize once. Export everywhere.
</p>


<UploadZone/>


</div>

</main>

);

}


export default App;