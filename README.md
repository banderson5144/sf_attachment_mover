# Salesforce Attachment Mover

Salesforce Attachment mover is a command-line application written in Node.js performs 3 opertaions

  - Import attachments from a CSV File
  - Export Attachments to a local zip file
  - Perform an Org Migration of Attachments

To run this program, open up a command prompt to directory of where you have installed the application and run:

```sh
node main.js
```

###Importing Attachments
Importing Attachments from a CSV file is pretty straight forward. Your CSV will contain two columns:
ParentId Lookup and file name. Here is a sample CSV file:

|ParentId|filePath|
| ------------- |:-------------:|
|001E0000016s7ok|test.html|

This file will then insert an attachment to a matching Account record. 

However, if you don't have the Salesforce Id accessible, you can also specify an External Id lookup to insert the attachment record. That would look like this:

|Account.External_Id__c|filePath|
| ------------- |:-------------:|
|12345abc|test.html|


You will have to modify the upload.csv file to meet your specifications and store your attachment files in the attFiles folder:

sfAttMover
|
+-- attFiles

|	\--test.html

+-- upload.csv

###Export Attachments
Attachments will be saved as a zip file with the following structure.

sfAttMover
+-- sfExp__ *randTime*.zip
|   \--*ParentId*-*randTime*-*Attachment.Name (Including Extension)*


###Org Migration
This tool has the ability to move attachments from one SF Org to another on a per object basis.
So if you want to move all attachments that are part of the Account object, you would specify your Source Org Object as Account. You then have specify what Parent Id lookup you want to perform. If you simply want to lookup the current Salesforce Id in your Target org, the just put "Id". If you want to reference an External Id field that contains the Parent Id from the source Org, then specify the API of that External Field