'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const Twitter = require('twitter');

function TwitterQuery(file) {
    this.topics = {};
    this.topicsFile = file;
    this.nodes = new Array();
    this.searchPeriod = 7; // max 7 according to Twitter API
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

TwitterQuery.prototype.readTopics = function() {
    try{
        this.topics = JSON.parse(fs.readFileSync(path.resolve(__dirname,this.topicsFile)));
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
        this.nodes.push({ 
            id: i.name, 
            parentId: i.parent,
            query: query
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
        )
    })

    let that = this;

    Promise.all(promises).then( function() {
        let nodesFile = `queryResult-${moment().format('YYYY-MM-DD')}.json`
        console.log("All Twitter queries done. Writing nodes to file...")
	let copiedFilePath = 'ai_twitter_activity.json';

        fs.writeFile(nodesFile, JSON.stringify(that.nodes), (err) => {
            if (err) throw err;
            console.log(`${nodesFile} successfully written.`)

	    fs.copyFile(nodesFile, copiedFilePath, (err) => {
		if (err) throw err;
		console.log(`${nodesFile} was copied to ${copiedFilePath}
		remember to now push to git`);
	    });

	}); // see here: https://stackoverflow.com/questions/34930771/why-is-this-undefined-inside-class-method-when-using-promises

	
 
    })
    .catch((error) => {
        console.log('Error: ', error)
    });


}

module.exports = TwitterQuery;
