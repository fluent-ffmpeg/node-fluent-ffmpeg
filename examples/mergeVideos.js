var ffmpeg = require('../index');

/*
 replicates this sequence of commands:

 ffmpeg -i title.mp4 -qscale:v 1 intermediate1.mpg
 ffmpeg -i source.mp4 -qscale:v 1 intermediate2.mpg
 ffmpeg -i concat:"intermediate1.mpg|intermediate2.mpg" -c copy intermediate_all.mpg
 ffmpeg -i intermediate_all.mpg -qscale:v 2 output.mp4
 */

var firstFile = "title.mp4";
var secondFile = "source.mp4"
var outPath = "out.mp4"
var tempFolderPath = "myTempFolder/"; // requires a temp folder to store intermediate videos, deletes them after merge is completed.

var proc = new ffmpeg({source:firstFile,nolog:true})
    .mergeAdd(secondFile)
    //.mergeAdd(thirdFile)
    //.mergeAdd(fourthFile)
    .mergeToFile(outPath,tempFolderPath,function(){
        console.log('files has been merged succesfully');
    });
