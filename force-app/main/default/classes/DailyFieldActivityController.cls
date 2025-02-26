public with sharing class DailyFieldActivityController {
    @AuraEnabled
    public static Daily_Field_Activity__c createDailyFieldActivity(Decimal odometerStart, String workingWith, DateTime startDateTime) {
        Id currentUserId = UserInfo.getUserId();
        
        // Check if user already has an active day
        List<Daily_Field_Activity__c> existingActivities = [
            SELECT Id 
            FROM Daily_Field_Activity__c 
            WHERE User__c = :currentUserId 
            AND Start_DateTime__c >= :Date.today() 
            AND Start_DateTime__c < :Date.today().addDays(1)
            AND Check__c = false
        ];
        
        if (!existingActivities.isEmpty()) {
            throw new AuraHandledException('You already have an active day started');
        }
        
        Daily_Field_Activity__c activity = new Daily_Field_Activity__c(
            Odometer_Start__c = odometerStart,
            Working_With__c = workingWith,
            Start_DateTime__c = startDateTime,
            User__c = currentUserId,
            Check__c = false
        );
        
        insert activity;
        return activity;
    }

    @AuraEnabled
    public static void updateDailyFieldActivity(Id recordId, Decimal odometerEnd, DateTime endDateTime, String fileData) {
        // Verify the record belongs to current user
        List<Daily_Field_Activity__c> activities = [
            SELECT Id, User__c 
            FROM Daily_Field_Activity__c 
            WHERE Id = :recordId AND User__c = :UserInfo.getUserId()
        ];
        
        if (activities.isEmpty()) {
            throw new AuraHandledException('Activity not found or you don\'t have permission');
        }
        
        Daily_Field_Activity__c activity = new Daily_Field_Activity__c(
            Id = recordId,
            Odometer_End__c = odometerEnd,
            End_DateTime__c = endDateTime,
            Check__c = true
        );
        update activity;

        if (String.isNotBlank(fileData)) {
            uploadFile(recordId, fileData, 'ODOMeter_End.jpg');
        }
    }

    @AuraEnabled
    public static void uploadFile(Id recordId, String fileData, String fileName) {
        // Create ContentVersion
        ContentVersion cv = new ContentVersion();
        cv.VersionData = EncodingUtil.base64Decode(fileData);
        cv.Title = fileName;
        cv.PathOnClient = fileName;
        insert cv;

        // Get Content Document Id
        Id conDocId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id =:cv.Id].ContentDocumentId;

        // Create ContentDocumentLink
        ContentDocumentLink cdl = new ContentDocumentLink();
        cdl.ContentDocumentId = conDocId;
        cdl.LinkedEntityId = recordId;
        cdl.ShareType = 'V';
        insert cdl;
    }

    @AuraEnabled(cacheable=true)
    public static Daily_Field_Activity__c getCurrentActivity() {
        try {
            Date today = Date.today();
            Id currentUserId = UserInfo.getUserId();
            
            List<Daily_Field_Activity__c> activities = [
                SELECT Id, End_DateTime__c, Check__c, User__c, Start_DateTime__c 
                FROM Daily_Field_Activity__c 
                WHERE User__c = :currentUserId 
                AND Start_DateTime__c >= :today 
                AND Start_DateTime__c < :today.addDays(1) 
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];
            
            System.debug('Found activities: ' + activities);
            return !activities.isEmpty() ? activities[0] : null;
        } catch (Exception e) {
            System.debug('Error in getCurrentActivity: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }
} 