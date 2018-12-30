'use strict';

const path = require('path');
const fs = require('fs');

function getFile(fname) {
    try {
	return fs.readFileSync(path.resolve(__dirname,fname));
    }
    catch (err) {
	throw(err);
    }
}    

function writeResults(nodes, cumulativeNodes, nodesFileName, cumulativeNodesFileName) {

    // write the nodes to a daily file
    let backupFileName = cumulativeNodesFileName+".bak";
    console.log(backupFileName);
    fs.writeFile(nodesFileName, JSON.stringify(nodes), (err) => {
	if (err) throw err;
	console.log(`${nodesFileName} successfully written.`)
    });

    // backup and then write the cumulativeNodes
    fs.copyFile(cumulativeNodesFileName, backupFileName, (err) => {
	if (err) throw err;
	console.log(`${cumulativeNodesFileName} was backed up successfully.`);

	// write the new cumulativeNodes
	fs.writeFile(cumulativeNodesFileName, JSON.stringify(cumulativeNodes), (err) => {
	    if (err) throw err;
	    console.log(`${cumulativeNodesFileName} updated successfully.`);
	});
    });
    
}


module.exports = {getFile, writeResults};
