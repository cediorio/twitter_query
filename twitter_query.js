'use strict';

require('dotenv').config();
const fh = require('./file_handling.js')
const moment = require('moment');
const Twitter = require('twitter');

/***
class TwitterQuery
Takes a file with a list of topics
***/
function TwitterQuery(file) {
    this.topics = {};
    this.topicsFile = process.env.TOPICS_FILENAME;
    this.nodes = new Array();
    this.cumulativeResults = new Array();
    this.searchPeriod = this.getSearchPeriod(this.getCumulativeResults(process.env.CUMULATIVE_RESULTS_FILENAME));
    this.searchDate =  moment().subtract(this.searchPeriod,'d').format('YYYY-MM-DD');
    this.location = {
        "Toronto": "43.666667,-79.416667,40km"
    };
    this.client = new Twitter({
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
        access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET    
    });
}

TwitterQuery.prototype.getSearchPeriod = function(cumulResults) {
    // accepts a json file (the cumulative results file)
    // return the number of days between the last search date (taken
    // from the cumulative results file) and the date the script is run
    let lastSearchDate;
    let maxTwitterAPISearchPeriod = 7;

    let dates = cumulResults.map(d => d.fetchDate);
    lastSearchDate = dates.reduce((a,b) => a > b ? a : b);
    let mFromDate = moment(lastSearchDate, 'YYYY-MM-DD');
    let mEndDate = moment();
    return Math.min(mEndDate.diff(mFromDate, 'days'), maxTwitterAPISearchPeriod);
}


TwitterQuery.prototype.getCumulativeResults = function(file) {
    try {
	return JSON.parse(fh.getFile(file));
    } catch (err) {
	throw(`There was an error opening ${file}: ${err.message}`);
    }
}

TwitterQuery.prototype.readTopics = function() {
    try{
        this.topics = JSON.parse(fh.getFile(this.topicsFile));
    }
    catch (err) {
        throw(`There was an error reading the topics file: ${err.message}`);
    }
    return true;
}

TwitterQuery.prototype.setNodes = function() {
    if(this.topics == 'undefined' | !this.topics.children) {
        try {
            this.readTopics();
        } catch(err) {
            throw new Error(`There was a problem setting the nodes: ${err.message}`);
        }
    }
    this.topics.children.forEach(i => {
        let query = i.query ? i.query : `\"${i.name}\"`;
	let fetchDate =  moment().format('YYYY-MM-DD');
        this.nodes.push({ 
            id: i.name, 
            parentId: i.parent,
            query: query,
	    fetchDate: fetchDate
        });
    });
    return true;
}

TwitterQuery.prototype.query = function() {
    if(!this.nodes.length) {
        try {
            this.setNodes();
        } catch (err) {
            throw new Error("Call to setNodes failed.")
        }
    }

    // much help on getting the promises working found here: 
    // https://stackoverflow.com/questions/38362231/how-to-use-promise-in-foreach-loop-of-array-to-populate-an-object

    let promises = [];

    this.nodes.forEach( (i,n) => {
        const params =  {
            q: i.query, 
            result_type: 'recent', 
            count: 100, 
            geocode: this.location.Toronto

        }
        // always filter out retweets and limit to searchPeriod
        params.q += ` -filter:retweets since:${this.searchDate}`;

        promises.push(
            this.client.get('search/tweets', params)
                .then( tweets => {
                    let len = tweets.statuses.length;
                    // len > 0 ? i.size = len : i.size = 1;
		    i.size = len;
                    console.log(`The node object size is now: ${i.size}`);
                })
                .catch( function(error){
                    console.log(error);
                })
        );

	// push a promise to get the cumulative results
	promises.push(this.cumulativeResults = this.getCumulativeResults(process.env.CUMULATIVE_RESULTS_FILENAME));
    })

    // see here: https://stackoverflow.com/questions/34930771/why-is-this-undefined-inside-class-method-when-using-promises
    let that = this;

    Promise.all(promises)
	.then( function() {
	    that.cumulativeResults = that.cumulativeResults.concat(that.nodes);
	})
	.then( function() {
            let nodesFile = `queryResult-${moment().format('YYYY-MM-DD')}.json`
            console.log("All Twitter queries done. Writing nodes to file...")
	    console.log(process.env.CUMULATIVE_RESULTS_FILENAME + "<-----");
	    fh.writeResults(that.nodes, that.cumulativeResults, nodesFile, process.env.CUMULATIVE_RESULTS_FILENAME);

	})
	.catch((error) => {
            console.log('Error: ', error)
	});


}

module.exports = TwitterQuery;
