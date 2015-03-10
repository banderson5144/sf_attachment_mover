#!/usr/bin/env node
var soap = require('soap'); //Create Webservice from WSDL
var fs = require('fs'); //Read Local files
var inquirer = require('inquirer'); //Asks questions
var csv = require('fast-csv'); //Parse CSV File
var qFile = require('./questions.js')

var url = 'partner.xml'; //Partner WSDL from Salesforce

var prodBoxUrl = 'https://login.salesforce.com/services/Soap/u/32.0';
var sandBoxUrl = 'https://test.salesforce.com/services/Soap/u/32.0';

var opType = '';

//If migrating from another SF Org, Source Org Information
var srcObj = '';
var srcLoginUrl = '';
var srcUsername = '';
var srcPassword = '';
var srcServerUrl = '';
var srcSessionId = '';
var srcClient;

//Target org where you are inserting attachments
var trgtLoginUrl = '';
var trgtUsername = '';
var trgtPassword = '';
var trgtServerUrl = '';
var trgtSessionId = '';
var trgtClient;

var trgtExtObjLkup = '';
var trgtExtFldLkup = '';

/* Variables for org to org attachment migration
 * We store the QueryResult()
 * http://www.salesforce.com/developer/docs/api/Content/sforce_api_calls_querymore_queryresult.htm#topic-title
 */
var qryMore = true; //done
var qryMoreId = ''; //queryLocator

/*
	Place holder variables to chunk up sending attachments
 */
var recSet = []; //Variable to hold a recordSet. Whether its from a csv File, or a query API call
var curRecSet = []; //Variable that holds a subset of attachment records to sent to Target Salesforce Org
var fileObj = {}; //Variable to store Ids and file Names to insert to Salesforce

/*
  Header Row for result file
*/
var hRow = 'Id,Errors\r\n';

fs.writeFile('results.csv',hRow,function(err){
  if(err)
  {
    throw err;
  }
  console.log('Result file Created\n');

  inquirer.prompt(qFile.tQs, function( a ) {
    trgtUsername = a.trgtun;
    trgtPassword = a.trgtpw;
    trgtLoginUrl = a.trgtEnv == 'Production' ? prodBoxUrl : sandBoxUrl;

    howToInsert();
  });
});

function howToInsert()
{
  console.log('\n');

  inquirer.prompt(qFile.iQs, function(a) {

    opType = a.insertType;

    if(opType == 'query')
    {
      queryOrg();
    }else
    {
      loadCSV();
    }
  });
}

function loadCSV()
{
  var rowCount = 1;
  fs.createReadStream("upload.csv")
    .pipe(csv())
    .on("data", function(data){

      if(rowCount == 1)
      {
        var lkupObj = data[0].split('.')
        if(lkupObj.length > 1)
        {
          trgtExtObjLkup = lkupObj[0];
          trgtExtFldLkup = lkupObj[1];
        }else
        {
          trgtExtFldLkup = 'Id';
        }
      }else
      {
    		if((data[0] in fileObj))
    		{
    			fileObj[data[0]].push(data[1]);
    		}else
    		{
    			fileObj[data[0]] = [data[1]];
    		}
      }

      rowCount++;
    })
    .on("end", function(){
      loginTrgt();
    });
}

function queryOrg()
{
  console.log('\n');

  inquirer.prompt(qFile.sQs, function(a) {

    srcLoginUrl = a.srcEnv == 'Production' ? prodBoxUrl : sandBoxUrl;
    srcUsername = a.srcun;
    srcPassword = a.srcpw;

    trgtExtObjLkup = a.srcObj;
    trgtExtFldLkup = a.extIdFld;

    loginTrgt();
  });
}

function loginTrgt()
{
  console.log('\nLogging into Target Org...');
  soap.createClient(url,
  function(err, client)
  {
    client.setEndpoint(trgtLoginUrl);

    client.SforceService.Soap.login(
    {
      username:trgtUsername,
      password:trgtPassword
    },
    function(err, r)
    {
      if(err != null)
      {
        var errMsg = err.root.Envelope.Body.Fault.faultstring;
        console.log(errMsg);
      }else
      {
        console.log('Success');
        trgtServerUrl = r.result.serverUrl;
        trgtSessionId = r.result.sessionId;
      }

      trgtClient = client;

      if(opType == 'query')
      {
        loginSrc(trgtClient);
      }else
      {
        retAttFromDisk();
      }
    })
  });
}


function loginSrc(client)
{
  console.log('\nLogging into Source Org...');

  client.setEndpoint(srcLoginUrl);

	client.SforceService.Soap.login
  (
    {
      username:srcUsername,
      password:srcPassword
    },
    function(err, r)
    {
      if(err != null)
      {
        var errMsg = err.root.Envelope.Body.Fault.faultstring;
        console.log(errMsg);
      }else
      {
        console.log('Success');
  	    srcServerUrl = r.result.serverUrl;
  	    srcSessionId = r.result.sessionId;

        srcClient = client;

        querySrcOrg(srcClient,buildOrgQry());
      }
    }
  );
}

function buildOrgQry()
{
  var qryString = "Select Id From Attachment WHERE Parent.Type = '" +
                  trgtExtObjLkup + "'";

  return qryString;
}

function querySrcOrg(client,queryString)
{
	client.clearSoapHeaders();
	client.setEndpoint(srcServerUrl);
	client.addSoapHeader({SessionHeader:{sessionId:srcSessionId}},'','tns');

	console.log('\nQuery Attachemnt Ids from Src Org');

	client.SforceService.Soap.query({query:queryString},
	function(err,res)
	{
		var sObjIds = [];
		//console.log(res.result.records);

    if(res.result.records != null)
    {

  		for(var i=0;i<res.result.records.length;i++)
  		{
  			var rec = res.result.records[i];

  			sObjIds.push(rec.Id[0]);
  		}

  		qryMore = res.result.done;
  		qryMoreId = res.result.queryLocator;

  		recSet = sObjIds;

  		for(var i=0;i<10;i++)
  		{
  			curRecSet.push(recSet[recSet.length-1]);
  			recSet.pop();
  		}


  		retAttFromSrc(srcClient,curRecSet);
    }else
    {
      console.log('No Attachments to move');
    }

	});
}

function qryMoreSrc(client,qryId)
{
	client.clearSoapHeaders();
	client.setEndpoint(srcServerUrl);
	client.addSoapHeader({SessionHeader:{sessionId:srcSessionId}},'','tns');

	console.log('Query More Attachemnt Ids from Src Org');

	client.SforceService.Soap.queryMore({queryLocator:qryId},
	function(err,res)
	{
		//console.log(client.lastRequest);
		var sObjIds = [];

		for(var i=0;i<res.result.records.length;i++)
		{
			var rec = res.result.records[i];

			sObjIds.push(rec.Id[0]);
		}

		qryMore = res.result.done;
		qryMoreId = res.result.queryLocator;

		recSet = sObjIds;

		for(var i=0;i<10;i++)
		{
			curRecSet.push(recSet[recSet.length-1]);
			recSet.pop();
		}


		retAtt(client,curRecSet);

	});
}

function retAttFromDisk()
{
  var recs = [];
  var myAtt = {};

  for(key in fileObj)
  {
    var fileArray = fileObj[key];

    var counter = fileArray.length >= 10 ? 10 : fileArray.length;

    for(var i=0;i<counter;i++)
    {
			var flds = {};

      var contents = fs.readFileSync('./attFiles/'+fileArray[fileArray.length-1]);
      var base64String = new Buffer(contents, 'binary').toString('base64');

      flds.type = 'Attachment';
			flds.Body = base64String;
			//flds.ContentType = attRes.ContentType;
			flds.Name = fileArray[fileArray.length-1];

      if(trgtExtFldLkup.toLowerCase() != 'id')
      {
        var objLkup = {};
        objLkup['type'] = trgtExtObjLkup;
        objLkup[trgtExtFldLkup] = key;

  			flds.Parent = objLkup;
      }else
      {
        flds.ParentId = key;
      }

      recs.push(flds);
      fileArray.pop();

      if(recs.length == 10)
      {
        myAtt.sObject = recs;
        createAttInTrgt(trgtClient,myAtt);
        fileObj[key] = fileArray;
        return;
      }
    }

    if(recs.length == 10)
    {
      myAtt.sObject = recs;
      createAttInTrgt(trgtClient,myAtt);
      return;
    }else
    {
      delete fileObj[key];
    }
  }

  if(recs.length > 0)
  {
    myAtt.sObject = recs;
    createAttInTrgt(trgtClient,myAtt);
    return;
  }else
  {
    console.log('done');
  }
}

function retAttFromSrc(client,sObjIds)
{
	console.log('\nRetrieving Attachment body from Src Org');
	client.clearSoapHeaders();
	client.setEndpoint(srcServerUrl);
	client.addSoapHeader({SessionHeader:{sessionId:srcSessionId}},'','tns');

	var retArgs = {};
	retArgs.fieldList = 'Id,Name,ParentId,Body,ContentType';
	retArgs.sObjectType = 'Attachment';
	retArgs.ids = sObjIds;

	client.SforceService.Soap.retrieve(retArgs,
	function(err,res)
	{
		var recs = [];

		for(i=0;i<res.result.length;i++)
		{
			//console.log('im in');
			var myAtt = {};
			var flds = {};
      var attRes = res.result[i];

			flds.type = 'Attachment';
			flds.Body = attRes.Body;
			flds.ContentType = attRes.ContentType;
			flds.Name = attRes.Name;

      if(trgtExtFldLkup.toLowerCase() != 'id')
      {
        var objLkup = {};
        objLkup['type'] = trgtExtObjLkup;
        objLkup[trgtExtFldLkup] = attRes.ParentId;

  			flds.Parent = objLkup;
      }else
      {
        flds.ParentId = attRes.ParentId;
      }

			recs.push(flds);
		}

		myAtt.sObject = recs;
		createAttInTrgt(client,myAtt);
	});
}

function processResult(res)
{
  var createResult = res.result;

  var resultRows = '';

  for(i=0;i<createResult.length;i++)
  {
    if(createResult[i].success)
    {
      resultRows = resultRows + createResult[i].id + ',\r\n';
    }else
    {
      resultRows = resultRows + ',' + createResult[i].errors[0].statusCode + ' - ' + createResult[i].errors[0].message + '\r\n';
    }
  }

  fs.appendFile('results.csv', resultRows, function (err) {

    if(opType == 'csv')
    {
      retAttFromDisk();
    }else
    {
      processQryMore();
    }

  });
}

function processQryMore()
{
  while(curRecSet.length > 0)
  {
    curRecSet.pop();
  }

  console.log(recSet.length)

  if(recSet.length > 0)
  {
    var count;

    if(recSet.length >= 10)
    {
      count = 10;
    }else
    {
      count = recSet.length
    }

    for(i=0;i<count;i++)
    {
      curRecSet.push(recSet[recSet.length-1]);
      recSet.pop();
    }
    retAttFromSrc(srcClient,curRecSet);
  }else if(!qryMore)
  {
    qryMoreSrc(srcClient,qryMoreId);
  }else
  {
    console.log('All done');
  }
}

function createAttInTrgt(client,recs)
{
	client.clearSoapHeaders();
	client.setEndpoint(trgtServerUrl);
	client.addSoapHeader({SessionHeader:{sessionId:trgtSessionId}},'','tns');
	console.log('\nInserting Attacments');

	client.SforceService.Soap.create(recs,
	function(err, response)
	{
    //console.log(client.lastRequest);
    /*fs.writeFile("lastReq.xml", client.lastRequest, function(err) {
      if(err) {
          console.log(err);
      } else {
          //console.log("The file was saved!");
      }
    });*/

		//console.log(response.result[0].errors);

    processResult(response);
	});
}
