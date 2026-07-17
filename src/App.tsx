import UploadZone from "./components/UploadZone";
import ImageEditor from "./components/ImageEditor";
import {useImage} from "./hooks/useImage";


export default function App(){


const {
    image,
    loadImage
}=useImage();



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
max-w-5xl
mx-auto
"
>


<h1 className="text-5xl font-bold mb-3">
ImageFit
</h1>


<p className="opacity-60 mb-10">
Resize once. Export everywhere.
</p>



{
!image &&

<UploadZone
onUpload={loadImage}
/>

}



{
image &&

<ImageEditor
image={image}
/>

}



</div>


</main>

);

}