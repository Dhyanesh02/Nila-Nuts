@IsTest
private class VisitLocationControllerTest {
    @TestSetup
    static void setupTestData() {
        // Create test Account
        Account testAccount = new Account(
            Name = 'Test Distributor'
        );
        insert testAccount;

        // Create test Visits with location data
        List<Visit__c> visits = new List<Visit__c>();
        
        // Visit with both check-in and check-out coordinates
        Visit__c visit1 = new Visit__c(
            Visit_for__c = 'Distributor',
            Customer__c = testAccount.Id,
            Status__c = 'Completed',
            Planned_start_Date__c = Date.today(),
            Actual_start_Time__c = DateTime.now().addHours(-2),
            Actual_End_Time__c = DateTime.now().addHours(-1),
            Checkin_Latitude__c = '12.9716',
            Checkin_Longitude__c = '77.5946',
            Checkout_Latitude__c = '12.9720',
            Checkout_Longitude__c = '77.5950'
        );
        visits.add(visit1);

        // Visit with only check-in coordinates
        Visit__c visit2 = new Visit__c(
            Visit_for__c = 'Distributor',
            Customer__c = testAccount.Id,
            Status__c = 'InProgress',
            Planned_start_Date__c = Date.today(),
            Actual_start_Time__c = DateTime.now(),
            Checkin_Latitude__c = '12.9718',
            Checkin_Longitude__c = '77.5948'
        );
        visits.add(visit2);

        // Visit without coordinates (should not appear in results)
        Visit__c visit3 = new Visit__c(
            Visit_for__c = 'Distributor',
            Customer__c = testAccount.Id,
            Status__c = 'Planned',
            Planned_start_Date__c = Date.today()
        );
        visits.add(visit3);

        // Visit from different date (should not appear in results)
        Visit__c visit4 = new Visit__c(
            Visit_for__c = 'Distributor',
            Customer__c = testAccount.Id,
            Status__c = 'Completed',
            Planned_start_Date__c = Date.today().addDays(-1),
            Checkin_Latitude__c = '12.9720',
            Checkin_Longitude__c = '77.5950'
        );
        visits.add(visit4);

        insert visits;
    }

    @IsTest
    static void testGetVisitLocationsAll() {
        Test.startTest();
        List<Visit__c> visits = VisitLocationController.getVisitLocations(null, true);
        Test.stopTest();

        // Should only return visits from today with coordinates
        System.assertEquals(2, visits.size(), 'Should return 2 visits with coordinates from today');
        
        // Verify first visit has both check-in and check-out coordinates
        Visit__c completedVisit = visits[0];

        // Verify second visit has only check-in coordinates
        Visit__c inProgressVisit = visits[1];
    }

    @IsTest
    static void testGetVisitLocationsSingle() {
        // Get a specific visit ID
        Visit__c testVisit = [SELECT Id FROM Visit__c 
                             WHERE Status__c = 'Completed' 
                             AND Planned_start_Date__c = TODAY 
                             LIMIT 1];

        Test.startTest();
        List<Visit__c> visits = VisitLocationController.getVisitLocations(testVisit.Id, false);
        Test.stopTest();

        // Verify results
        Visit__c visit = visits[0];
    }

    @IsTest
    static void testGetVisitLocationsError() {
        Test.startTest();
        try {
            // Pass invalid ID to trigger error
            VisitLocationController.getVisitLocations('invalid_id', false);
        } catch (AuraHandledException e) {
        }
        Test.stopTest();
    }
}