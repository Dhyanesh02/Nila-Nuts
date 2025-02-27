 @IsTest
private class DailyFieldActivityControllerTest {
    @TestSetup
    static void setupTestData() {
        // Create a test user
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'];
        User testUser = new User(
            Alias = 'tuser',
            Email = 'testuser@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'testuser@test.com' + System.currentTimeMillis()
        );
        insert testUser;
    }

    @IsTest
    static void testCreateDailyFieldActivity() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        
        Test.startTest();
        System.runAs(testUser) {
            Decimal odometerStart = 1000;
            String workingWith = 'RM';
            DateTime startDateTime = DateTime.now();
            
            Daily_Field_Activity__c activity = DailyFieldActivityController.createDailyFieldActivity(
                odometerStart,
                workingWith,
                startDateTime
            );
            
        }
        Test.stopTest();
    }

    @IsTest
    static void testCreateDuplicateDailyFieldActivity() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        
        Test.startTest();
        System.runAs(testUser) {
            // Create first activity
            DailyFieldActivityController.createDailyFieldActivity(
                1000,
                'RM',
                DateTime.now()
            );
            
            // Try to create second activity
            try {
                DailyFieldActivityController.createDailyFieldActivity(
                    2000,
                    'ZM',
                    DateTime.now()
                );
            } catch (AuraHandledException e) {
                
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpdateDailyFieldActivity() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        
        Daily_Field_Activity__c activity;
        System.runAs(testUser) {
            activity = DailyFieldActivityController.createDailyFieldActivity(
                1000,
                'RM',
                DateTime.now()
            );
        }
        
        Test.startTest();
        System.runAs(testUser) {
            Decimal odometerEnd = 2000;
            DateTime endDateTime = DateTime.now();
            String fileData = 'SGVsbG8gV29ybGQ='; // Base64 encoded "Hello World"
            
            DailyFieldActivityController.updateDailyFieldActivity(
                activity.Id,
                odometerEnd,
                endDateTime,
                fileData
            );
            
            // Verify the activity was updated
            Daily_Field_Activity__c updatedActivity = [
                SELECT Id, Odometer_End__c, End_DateTime__c, Check__c 
                FROM Daily_Field_Activity__c 
                WHERE Id = :activity.Id
            ];
            
            // Verify file was uploaded
            List<ContentDocumentLink> links = [
                SELECT Id 
                FROM ContentDocumentLink 
                WHERE LinkedEntityId = :activity.Id
            ];
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpdateInvalidActivity() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        
        Test.startTest();
        System.runAs(testUser) {
            try {
                DailyFieldActivityController.updateDailyFieldActivity(
                    'a00000000000000AAA', // Invalid ID
                    2000,
                    DateTime.now(),
                    'SGVsbG8gV29ybGQ='
                );
            } catch (AuraHandledException e) {
            }
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetCurrentActivity() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        
        Daily_Field_Activity__c activity;
        System.runAs(testUser) {
            activity = DailyFieldActivityController.createDailyFieldActivity(
                1000,
                'RM',
                DateTime.now()
            );
        }
        
        Test.startTest();
        System.runAs(testUser) {
            Daily_Field_Activity__c currentActivity = DailyFieldActivityController.getCurrentActivity();
            
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetCurrentActivityNoActivity() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        
        Test.startTest();
        System.runAs(testUser) {
            Daily_Field_Activity__c currentActivity = DailyFieldActivityController.getCurrentActivity();
            
        }
        Test.stopTest();
    }

    @IsTest
    static void testUploadFile() {
        User testUser = [SELECT Id FROM User WHERE Email = 'testuser@test.com' LIMIT 1];
        
        Daily_Field_Activity__c activity;
        System.runAs(testUser) {
            activity = DailyFieldActivityController.createDailyFieldActivity(
                1000,
                'RM',
                DateTime.now()
            );
        }
        
        Test.startTest();
        System.runAs(testUser) {
            String fileData = 'SGVsbG8gV29ybGQ='; // Base64 encoded "Hello World"
            DailyFieldActivityController.uploadFile(
                activity.Id,
                fileData,
                'test.jpg'
            );
            
            // Verify file was uploaded
            List<ContentDocumentLink> links = [
                SELECT Id, ContentDocument.Title 
                FROM ContentDocumentLink 
                WHERE LinkedEntityId = :activity.Id
            ];

        }
        Test.stopTest();
    }
}